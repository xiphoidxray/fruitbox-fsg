use axum::{
    body::Bytes,
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::any,
    Router,
};
use axum_extra::TypedHeader;
use server_state::{AppState, RoomState, GAME_DURATION_SECS};
use tokio::sync::broadcast::{self, error::RecvError};
use ws_messages::{BoardData, PlayerId, RoomId, WsClientMsg, WsServerMsg, COLS, ROWS};

use std::{net::SocketAddr, path::PathBuf, time::Duration};
use tower_http::{
    services::ServeDir,
    trace::{DefaultMakeSpan, TraceLayer},
};

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// allows to extract the IP of connecting user
use axum::extract::connect_info::ConnectInfo;

pub mod server_state;
pub mod ws_messages;

/// Holds all of the per‐connection mutable state:
///   - which room this socket has joined (if any)
///   - this client’s PlayerId (once they create or join)
///   - the broadcast‐receiver, used to forward room broadcasts back to this socket
struct ConnContext {
    joined_room: Option<RoomId>,
    my_player_id: Option<PlayerId>,
    room_rx: Option<broadcast::Receiver<WsServerMsg>>,
}

impl ConnContext {
    fn new() -> Self {
        ConnContext {
            joined_room: None,
            my_player_id: None,
            room_rx: None,
        }
    }
}

impl ConnContext {
    pub fn require_room_and_player<'a>(
        &'a self,
    ) -> Result<(&'a RoomId, &'a PlayerId), WsServerMsg> {
        let room_id = self
            .joined_room
            .as_ref()
            .ok_or_else(|| WsServerMsg::Error {
                room_id: None,
                msg: "Not in a room".to_string(),
            })?;

        let player_id = self
            .my_player_id
            .as_ref()
            .ok_or_else(|| WsServerMsg::Error {
                room_id: Some(room_id.clone()),
                msg: "Player ID not assigned".to_string(),
            })?;

        Ok((room_id, player_id))
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                format!("{}=debug,tower_http=warn", env!("CARGO_CRATE_NAME")).into()
            }),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // serve the frontend
    let assets_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("frontend")
        .join("dist");

    // Load persisted top-10 scores from disk
    let top_10 = AppState::load_top_10().await;
    println!("top_10 loaded: {:#?}", top_10);
    let state = AppState::new_with_top_10(top_10);

    let app = Router::new()
        .fallback_service(ServeDir::new(assets_dir).append_index_html_on_directories(true))
        .route("/ws", any(ws_handler))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        )
        .with_state(state.clone());

    let addr = SocketAddr::from(([127, 0, 0, 1], 3123));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();

    tracing::debug!("listening on {}", listener.local_addr().unwrap());

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}

/// The handler for the HTTP request that upgrades to WebSocket.
/// We also log the user‐agent and client address once per connection.
async fn ws_handler(
    ws: WebSocketUpgrade,
    user_agent: Option<TypedHeader<headers::UserAgent>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let user_agent = if let Some(TypedHeader(ua)) = user_agent {
        ua.to_string()
    } else {
        String::from("Unknown browser")
    };
    println!("`{user_agent}` at {addr} connected.");
    ws.on_upgrade(move |socket| handle_socket(socket, addr, state))
}

/// Actual WebSocket state machine: one instance per connection.
async fn handle_socket(mut socket: WebSocket, who: SocketAddr, state: AppState) {
    // send a ping to start the conversation
    if socket
        .send(Message::Ping(Bytes::from_static(&[1, 2, 3])))
        .await
        .is_ok()
    {
        println!("Pinged {who}...");
    } else {
        println!("Could not send ping {who}! Closing.");
        return;
    }

    // expect a Pong back
    if let Some(Ok(Message::Pong(_))) = socket.recv().await {
        println!("Received Pong from {who}. Continuing.");
    } else {
        println!("Did not receive Pong from {who}; closing.");
        return;
    }

    handle_connection(socket, state).await;

    // once handle_connection returns, we close this WebSocket
    println!("WebSocket context {who} destroyed");
}

/// The “per‐connection” logic, now using a `ConnContext` to group mutable state.
/// First: send the Top-10 snapshot to the client, then loop reading either:
///   1) a broadcast message from the room, or
///   2) a client→server JSON text message.
async fn handle_connection(mut ws: WebSocket, state: AppState) {
    // initialize our per-connection context
    let mut ctx = ConnContext::new();

    // 1) Send Top-10 scores immediately on connect
    let scores: Vec<(u32, String)> = state
        .top_10
        .lock()
        .await
        .clone()
        .into_sorted_vec()
        .into_iter()
        .map(|r| (r.0 .0, r.1))
        .collect();
    let top_10_msg = WsServerMsg::Top10Scores { scores };
    let _ = ws
        .send(Message::Text(
            serde_json::to_string(&top_10_msg).unwrap().into(),
        ))
        .await;

    // 2) Enter main event loop:
    loop {
        tokio::select! {
            // (A) If we have a subscription to a room's broadcast channel, wait for it:
            biased;
            Some(room_rx_result) = async { if let Some(rx) = ctx.room_rx.as_mut() { Some(rx.recv().await) } else { None } } => {
                match room_rx_result {
                    Ok(server_msg) => {
                        let text = serde_json::to_string(&server_msg).unwrap();
                        if ws.send(Message::Text(text.into())).await.is_err() {
                            break; // client disconnected
                        }
                    }
                    Err(RecvError::Lagged(_)) => {
                        // missed some messages → we just continue
                        continue;
                    }
                    Err(RecvError::Closed) => {
                        // room was closed → notify client, then break
                        let close_payload = WsServerMsg::Error {
                            room_id: ctx.joined_room.clone(),
                            msg: "Room closed".to_string(),
                        };
                        let text = serde_json::to_string(&close_payload).unwrap();
                        let _ = ws.send(Message::Text(text.into())).await;
                        break;
                    }
                }
            },

            // (B) Read client→server message
            Some(Ok(msg)) = ws.recv() => {
                if let Message::Text(txt) = msg {
                    match serde_json::from_str::<WsClientMsg>(&txt) {
                        Ok(client_msg) => {
                            if let Err(err) = handle_client_msg(client_msg, &mut ctx, &state, &mut ws).await {
                                let text = serde_json::to_string(&err).unwrap();
                                let _ = ws.send(Message::Text(text.into())).await;
                            };
                        }
                        Err(e) => {
                            let err = WsServerMsg::Error {
                                room_id: ctx.joined_room.clone(),
                                msg: format!("Invalid JSON: {}", e),
                            };
                            let text = serde_json::to_string(&err).unwrap();
                            let _ = ws.send(Message::Text(text.into())).await;
                        }
                    }
                }
            },

            // (C) If WebSocket closed or errored, exit loop
            else => break,
        }
    }

    // Clean up if the client was in a room when they disconnected
    if let (Some(room_id), Some(pid)) = (&ctx.joined_room, &ctx.my_player_id) {
        remove_player_from_room(room_id, pid, &state).await;
    }

    println!("WebSocket connection closed");
}

/// Handles a single client→server JSON message.
/// All mutable per-connection state (joined_room, my_player_id, room_rx) is inside `ctx`.
async fn handle_client_msg(
    client_msg: WsClientMsg,
    ctx: &mut ConnContext,
    state: &AppState,
    ws: &mut WebSocket,
) -> Result<(), WsServerMsg> {
    // println!("got client msg: {:?}", client_msg);
    match client_msg {
        WsClientMsg::CreateRoom { player } => {
            // 1) Generate a new random RoomId (UUID string)
            let room_id = uuid::Uuid::new_v4().to_string();

            // 2) Create a fresh RoomState and insert it into global AppState
            let mut rooms = state.rooms.lock().await;
            let mut room_state = RoomState::new(player.clone());
            let owner_id = room_state.owner.clone();
            room_state.scores.insert(player.player_id.clone(), 0);
            let rx = room_state.tx.subscribe();
            rooms.insert(room_id.clone(), room_state);
            drop(rooms);

            // 3) Update this connection's context
            ctx.joined_room = Some(room_id.clone());
            ctx.my_player_id = Some(player.player_id.clone());
            ctx.room_rx = Some(rx);

            // 4) Debug print
            println!("{} created room {}", player.name, room_id);

            // 5) Send back RoomCreated and JoinedRoom
            let created = WsServerMsg::RoomCreated {
                room_id: room_id.clone(),
            };
            let joined = WsServerMsg::RoomPlayersUpdate {
                room_id: room_id.clone(),
                players: vec![player.clone()],
                owner_id,
            };
            let _ = ws
                .send(Message::Text(
                    serde_json::to_string(&created).unwrap().into(),
                ))
                .await;
            let _ = ws
                .send(Message::Text(
                    serde_json::to_string(&joined).unwrap().into(),
                ))
                .await;
            Ok(())
        }

        WsClientMsg::JoinRoom { room_id, player } => {
            // 1) Try to add this player to an existing room
            let mut rooms = state.rooms.lock().await;
            let player_id = player.player_id.clone();
            if let Some(room_state) = rooms.get_mut(&room_id) {
                if room_state.players.contains_key(&player_id) {
                    return Err(WsServerMsg::Error {
                        room_id: Some(room_id.clone()),
                        msg: "Already in room".to_string(),
                    });
                }
                // 2) Insert into room’s player list and reset their score
                room_state.players.insert(player_id.clone(), player.clone());
                room_state.scores.insert(player_id.clone(), 0);

                // Debug print
                println!("room_state after join: {:#?}", room_state);

                // 3) Subscribe to that room’s broadcast channel
                let rx = room_state.tx.subscribe();

                // 4) Broadcast updated player list
                let players: Vec<_> = room_state.players.values().cloned().collect();
                let owner_id = room_state.owner.clone();
                let msg = WsServerMsg::RoomPlayersUpdate {
                    room_id: room_id.clone(),
                    players: players.clone(),
                    owner_id: room_state.owner.clone(),
                };
                let _ = room_state.tx.send(msg);
                drop(rooms);

                // 5) Update context
                ctx.joined_room = Some(room_id.clone());
                ctx.my_player_id = Some(player_id.clone());
                ctx.room_rx = Some(rx);

                // Debug print
                println!("{} joined room {}", player.name, room_id);

                // 6) Acknowledge to the joining client
                let joined_msg = WsServerMsg::RoomPlayersUpdate {
                    room_id: room_id.clone(),
                    players,
                    owner_id,
                };
                let _ = ws
                    .send(Message::Text(
                        serde_json::to_string(&joined_msg).unwrap().into(),
                    ))
                    .await;
            } else {
                // Room doesn’t exist
                return Err(WsServerMsg::Error {
                    room_id: Some(room_id.clone()),
                    msg: "Room not found".to_string(),
                });
            }
            Ok(())
        }
        WsClientMsg::ReadyUp { ready } => {
            let mut rooms = state.rooms.lock().await;
            let (room_id, player_id) = ctx.require_room_and_player()?;

            // Get the room
            let Some(room_state) = rooms.get_mut(room_id) else {
                return Err(WsServerMsg::Error {
                    room_id: Some(room_id.clone()),
                    msg: "Room not found".to_string(),
                });
            };

            // Get the player
            let Some(player) = room_state.players.get_mut(player_id) else {
                return Err(WsServerMsg::Error {
                    room_id: Some(room_id.clone()),
                    msg: "You are not in a room".to_string(),
                });
            };

            // Update ready status
            player.ready = ready;
            println!("{} is now ready: {}", player.name, ready);

            // Broadcast updated player list + owner ID
            let players: Vec<_> = room_state.players.values().cloned().collect();
            let msg = WsServerMsg::RoomPlayersUpdate {
                room_id: room_id.clone(),
                players,
                owner_id: room_state.owner.clone(),
            };
            let _ = room_state.tx.send(msg);
            Ok(())
        }

        WsClientMsg::StartGame {} => {
            // 1) Only the owner may start
            let mut rooms = state.rooms.lock().await;
            let (room_id, _) = ctx.require_room_and_player()?;
            if let Some(room_state) = rooms.get_mut(room_id) {
                let caller = ctx.my_player_id.as_ref().unwrap();
                if *caller != room_state.owner {
                    return Err(WsServerMsg::Error {
                        room_id: Some(room_id.clone()),
                        msg: "Only owner can start".to_string(),
                    });
                }
                // Check if all players are ready
                let all_ready = room_state
                    .players
                    .values()
                    .filter(|&p| p.player_id != room_state.owner)
                    .all(|p| p.ready);
                if !all_ready {
                    return Err(WsServerMsg::Error {
                        room_id: Some(room_id.clone()),
                        msg: "All players must be ready".to_string(),
                    });
                }

                let name = room_state
                    .players
                    .get(caller)
                    .map_or("Unknown player", |p| p.name.as_str());
                println!("{} started game with room id {}", name, room_id);

                // 2) If a prior timer was running, cancel it
                if let Some(handle) = room_state.timer_handle.take() {
                    println!("Cancelling previous timer for room {}", room_id);
                    let _ = handle.abort();
                }

                // 3) Generate a new random board
                let mut board: BoardData = Vec::new();
                for _y in 0..ROWS {
                    for _x in 0..COLS {
                        let val = 1 + rand::random::<u8>() % 9;
                        board.push(val);
                    }
                }
                room_state.board = Some(board.clone());
                println!("Generated new board for room {}: {:?}", room_id, board);

                // 4) Reset all players’ scores in this room
                for pid in room_state.players.keys() {
                    room_state.scores.insert(pid.clone(), 0);
                }

                // 5) Broadcast GameStarted to everyone in room
                let start_msg = WsServerMsg::GameStarted {
                    room_id: room_id.clone(),
                    board: board.clone(),
                    duration_secs: GAME_DURATION_SECS,
                };
                // make all players other than the owner un ready
                for player in room_state.players.values_mut() {
                    player.ready = false;
                }
                let players: Vec<_> = room_state.players.values().cloned().collect();
                let msg = WsServerMsg::RoomPlayersUpdate {
                    room_id: room_id.clone(),
                    players,
                    owner_id: room_state.owner.clone(),
                };
                let _ = room_state.tx.send(msg);
                let _ = room_state.tx.send(start_msg);

                // 6) Spawn a countdown task that also updates global top-10 when finished
                let tx_clone = room_state.tx.clone();
                let room_clone = room_id.clone();
                let top_10_arc = state.top_10.clone();
                let rooms_clone = state.rooms.clone();
                let handle = tokio::spawn(async move {
                    for sec_left in (0..=GAME_DURATION_SECS).rev() {
                        let tick = WsServerMsg::TimerTick {
                            room_id: room_clone.clone(),
                            remaining_secs: sec_left,
                        };
                        let _ = tx_clone.send(tick);
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }

                    // Once timer hits zero, record final scores into top-10
                    {
                        let mut top_10 = top_10_arc.lock().await;
                        let mut rooms = rooms_clone.lock().await;

                        if let Some(room_state) = rooms.get_mut(&room_clone) {
                            println!(
                                "Game timer for room {} finished, scores: {:?}",
                                room_clone, room_state.scores
                            );

                            let mut changed = false;
                            for (pid, score) in room_state.scores.iter() {
                                if let Some(player) = room_state.players.get(pid) {
                                    let player_name = player.name.clone();
                                    if top_10.len() < 10 {
                                        top_10.push((std::cmp::Reverse(*score), player_name));
                                        changed = true;
                                    } else if let Some((std::cmp::Reverse(min_score), _)) =
                                        top_10.peek()
                                    {
                                        if *score > *min_score {
                                            println!(
                                                "Updating top-10: {} scored {}",
                                                player_name, score
                                            );
                                            top_10.pop();
                                            top_10.push((std::cmp::Reverse(*score), player_name));
                                            changed = true;
                                        }
                                    }
                                }
                            }

                            if changed {
                                AppState::save_top_10(&top_10).await;
                            }
                        }
                    }
                });
                room_state.timer_handle = Some(handle);
                drop(rooms);
            } else {
                let err = WsServerMsg::Error {
                    room_id: Some(room_id.clone()),
                    msg: "Room not found".to_string(),
                };
                let _ = ws
                    .send(Message::Text(serde_json::to_string(&err).unwrap().into()))
                    .await;
            }
            Ok(())
        }

        WsClientMsg::ScoreUpdate { cleared_count } => {
            let (room_id, player_id) = ctx.require_room_and_player()?;
            let mut rooms = state.rooms.lock().await;
            if let Some(room_state) = rooms.get_mut(room_id) {
                if !room_state.players.contains_key(player_id) {
                    return Err(WsServerMsg::Error {
                        room_id: Some(room_id.clone()),
                        msg: "Not in room".to_string(),
                    });
                }

                // 1) Update this player’s score in the room
                let entry = room_state.scores.entry(player_id.clone()).or_insert(0);
                *entry += cleared_count;

                // 2) Debug print: who scored how much
                if let Some(player) = room_state.players.get(player_id) {
                    println!("{} scored {}, total {}", player.name, cleared_count, entry);
                }

                // 3) Broadcast updated leaderboard to all clients in room
                let scores_vec: Vec<_> = room_state
                    .scores
                    .iter()
                    .map(|(pid, &s)| (pid.clone(), s))
                    .collect();
                let lb_msg = WsServerMsg::LeaderboardUpdate {
                    room_id: room_id.clone(),
                    scores: scores_vec,
                };
                let _ = room_state.tx.send(lb_msg);
                drop(rooms);
            } else {
                return Err(WsServerMsg::Error {
                    room_id: Some(room_id.clone()),
                    msg: "Room not found".to_string(),
                });
            }
            Ok(())
        }

        WsClientMsg::ChatMessage { message } => {
            let (room_id, player_id) = ctx.require_room_and_player()?;

            // 2) Broadcast the chat to everyone in the room
            let mut rooms = state.rooms.lock().await;
            if let Some(room_state) = rooms.get_mut(room_id) {
                if let Some(player) = room_state.players.get(player_id) {
                    let chat_msg = WsServerMsg::ChatBroadcast {
                        room_id: room_id.clone(),
                        player: player.clone(),
                        message: message.clone(),
                    };
                    println!("{} send chat message: {}", player.name, message);
                    let _ = room_state.tx.send(chat_msg);
                } else {
                    return Err(WsServerMsg::Error {
                        room_id: Some(room_id.clone()),
                        msg: "You are not a player in this room".to_string(),
                    });
                }
                Ok(())
            } else {
                return Err(WsServerMsg::Error {
                    room_id: Some(room_id.clone()),
                    msg: "Room not found".to_string(),
                });
            }
        }
    }
}

/// If a client disconnects without properly leaving the room, remove them from that room's state.
/// If they were the owner, you could optionally dissolve the room or reassign ownership.
async fn remove_player_from_room(room_id: &RoomId, player_id: &PlayerId, state: &AppState) {
    let mut rooms = state.rooms.lock().await;
    if let Some(room_state) = rooms.get_mut(room_id) {
        let player_name = room_state
            .players
            .get(player_id)
            .map_or("Unknown player", |p| p.name.as_str())
            .to_owned();
        room_state.players.remove(player_id);
        room_state.scores.remove(player_id);

        // Broadcast new player list
        let players: Vec<_> = room_state.players.values().cloned().collect();
        let msg = WsServerMsg::RoomPlayersUpdate {
            room_id: room_id.clone(),
            players,
            owner_id: room_state.owner.clone(),
        };
        let _ = room_state.tx.send(msg);

        // If no players remain, destroy the room (and cancel timer)
        if room_state.players.is_empty() {
            if let Some(handle) = room_state.timer_handle.take() {
                let _ = handle.abort();
            }
            println!("Room {} is empty, removing it.", room_id);
            rooms.remove(room_id);
        }
        // If owner left, you could pick a new one or close the room entirely:
        else if &room_state.owner == player_id {
            // e.g. reassign or clean up:
            let new_owner = room_state.players.iter().next().map(|(_, p)| p.player_id.clone());
            room_state.owner = new_owner.unwrap_or_default();
            println!(
                "Owner {} left room {}, removing room.",
                player_name, room_id
            );
        }
    }
}
