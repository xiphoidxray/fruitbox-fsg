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

//allows to extract the IP of connecting user
use axum::extract::connect_info::ConnectInfo;

pub mod server_state;
pub mod ws_messages;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                format!("{}=debug,tower_http=debug", env!("CARGO_CRATE_NAME")).into()
            }),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // serve the frontend
    let assets_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("frontend")
        .join("dist");

    let top_10 = AppState::load_top_10().await;
    println!("top_10 loaded: {:#?}", top_10);
    let state = AppState::new_with_top_10(top_10);
    let app = Router::new()
        .fallback_service(ServeDir::new(assets_dir).append_index_html_on_directories(true))
        .route("/ws", any(ws_handler))
        .layer(
            TraceLayer::new_for_http() // logging so we can see what's going on
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        )
        .with_state(state.clone());

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();

    tracing::debug!("listening on {}", listener.local_addr().unwrap());

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}

/// The handler for the HTTP request and switches from HTTP to
/// websocket protocol.
/// This is the last point where we can extract TCP/IP metadata such as IP address of the client
/// as well as things from HTTP headers such as user-agent of the browser etc.
async fn ws_handler(
    ws: WebSocketUpgrade,
    user_agent: Option<TypedHeader<headers::UserAgent>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let user_agent = if let Some(TypedHeader(user_agent)) = user_agent {
        user_agent.to_string()
    } else {
        String::from("Unknown browser")
    };
    println!("`{user_agent}` at {addr} connected.");
    ws.on_upgrade(move |socket| handle_socket(socket, addr, state))
}

/// Actual websocket statemachine (one will be spawned per connection)
async fn handle_socket(mut socket: WebSocket, who: SocketAddr, state: AppState) {
    // send a ping (unsupported by some browsers) just to kick things off and get a response
    if socket
        .send(Message::Ping(Bytes::from_static(&[1, 2, 3])))
        .await
        .is_ok()
    {
        println!("Pinged {who}...");
    } else {
        println!("Could not send ping {who}!");
        // no Error here since the only thing we can do is to close the connection.
        // If we can not send messages, there is no way to salvage the statemachine anyway.
        return;
    }

    // receive single message from a client (we can either receive or send with socket).
    // this will likely be the Pong for our Ping or a hello message from client.
    // waiting for message from a client will block this task, but will not block other client's
    // connections.
    if let Some(Ok(Message::Pong(_))) = socket.recv().await {
        println!("Received Pong from {who}—let’s proceed.");
    } else {
        println!("Did not receive Pong; closing.");
        return;
    }

    handle_connection(socket, state).await;

    // returning from the handler closes the websocket connection
    println!("Websocket context {who} destroyed");
}

/// The “per‐connection” logic.
async fn handle_connection(mut ws: WebSocket, state: AppState) {
    // We need to track which room (if any) this socket is in, and the player's ID.
    let mut joined_room: Option<RoomId> = None;
    let mut my_player_id: Option<PlayerId> = None;

    // We’ll hold a `broadcast::Receiver<WsServerMsg>` once the client joins a room
    // so that we can forward updates to this socket.
    let mut room_rx_opt: Option<broadcast::Receiver<WsServerMsg>> = None;

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

    // Loop until the socket is closed
    loop {
        tokio::select! {
            // if this socket is subscribed to a room, try to pull the next broadcast msg:
            biased;
            Some(room_rx) = async { if let Some(rx) = room_rx_opt.as_mut() { Some(rx.recv().await) } else { None } } => {
                match room_rx {
                    Ok(server_msg) => {
                        // Serialize and send to the client as text
                        let text = serde_json::to_string(&server_msg).unwrap();
                        if ws.send(Message::Text(text.into())).await.is_err() {
                            break; // client disconnected
                        }
                    }
                    Err(RecvError::Lagged(_)) => {
                        // we skipped some messages; you could choose to send a full snapshot instead
                        continue;
                    }
                    Err(RecvError::Closed) => {
                        // The room is gone (perhaps it was deleted); close the socket.
                        let close_payload = WsServerMsg::Error { room_id: joined_room.clone(), msg: "Room closed".to_string() };
                        let text = serde_json::to_string(&close_payload).unwrap();
                        let _ = ws.send(Message::Text(text.into())).await;
                        break;
                    }
                }
            },

            // Read the next client→server message
            Some(Ok(msg)) = ws.recv() => {
                if let Message::Text(txt) = msg {
                    match serde_json::from_str::<WsClientMsg>(&txt) {
                        Ok(client_msg) => {
                            handle_client_msg(client_msg, &mut joined_room, &mut my_player_id, &mut room_rx_opt, &state, &mut ws).await;
                        }
                        Err(e) => {
                            let err = WsServerMsg::Error { room_id: joined_room.clone(), msg: format!("Invalid JSON: {}", e) };
                            let text = serde_json::to_string(&err).unwrap();
                            let _ = ws.send(Message::Text(text.into())).await;
                        }
                    }
                }
            },

            // If the socket actually closed or errored, break out
            else => break,
        }
    }

    // Clean up: if we were in a room, remove ourselves from that room's state.
    if let (Some(room_id), Some(pid)) = (&joined_room, &my_player_id) {
        remove_player_from_room(room_id, pid, &state).await;
    }

    println!("WebSocket connection closed");
}

/// Core logic to handle a single client‐message.
async fn handle_client_msg(
    client_msg: WsClientMsg,
    joined_room: &mut Option<RoomId>,
    my_player_id: &mut Option<PlayerId>,
    room_rx_opt: &mut Option<broadcast::Receiver<WsServerMsg>>,
    state: &AppState,
    ws: &mut WebSocket,
) {
    println!("got client msg {:#?}", client_msg);
    match client_msg {
        WsClientMsg::CreateRoom { player } => {
            // Generate a new RoomId (e.g. UUID or random 6‐digit code).
            let room_id = uuid::Uuid::new_v4().to_string();

            // Create the RoomState and insert into global state.
            let mut rooms = state.rooms.lock().await;
            let mut room_state = RoomState::new(player.clone());
            room_state.scores.insert(player.player_id.clone(), 0);
            let rx = room_state.tx.subscribe();
            rooms.insert(room_id.clone(), room_state);
            drop(rooms); // unlock

            // Mark in this connection that we are in this room
            *joined_room = Some(room_id.clone());
            *my_player_id = Some(player.player_id.clone());
            *room_rx_opt = Some(rx);

            // Send back RoomCreated and JoinedRoom messages
            let created = WsServerMsg::RoomCreated {
                room_id: room_id.clone(),
            };
            let joined = WsServerMsg::JoinedRoom {
                room_id: room_id.clone(),
                players: vec![player],
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
        }

        WsClientMsg::JoinRoom { room_id, player } => {
            // Try to add this player to the existing room
            let mut rooms = state.rooms.lock().await;
            let player_id = player.player_id.clone();
            if let Some(room_state) = rooms.get_mut(&room_id) {
                // Add player
                if room_state.players.contains_key(&player_id) {
                    let err = WsServerMsg::Error {
                        room_id: Some(room_id.clone()),
                        msg: "Already in room".to_string(),
                    };
                    let _ = ws
                        .send(Message::Text(serde_json::to_string(&err).unwrap().into()))
                        .await;
                    return;
                }
                room_state.players.insert(player_id.clone(), player.clone());
                room_state.scores.insert(player_id.clone(), 0);
                println!("room_state: {:#?}", room_state);
                let rx = room_state.tx.subscribe();
                // broadcast updated player list
                let players: Vec<_> = room_state.players.values().cloned().collect();
                let msg = WsServerMsg::RoomPlayersUpdate {
                    room_id: room_id.clone(),
                    players: players.clone(),
                };
                let _ = room_state.tx.send(msg);

                drop(rooms); // unlock

                *joined_room = Some(room_id.clone());
                *my_player_id = Some(player_id.clone());
                *room_rx_opt = Some(rx);

                // Acknowledge to the joining client
                let joined = WsServerMsg::JoinedRoom {
                    room_id: room_id.clone(),
                    players,
                };
                let _ = ws
                    .send(Message::Text(
                        serde_json::to_string(&joined).unwrap().into(),
                    ))
                    .await;
            } else {
                // Room doesn’t exist
                let err = WsServerMsg::Error {
                    room_id: Some(room_id.clone()),
                    msg: "Room not found".to_string(),
                };
                let _ = ws
                    .send(Message::Text(serde_json::to_string(&err).unwrap().into()))
                    .await;
            }
        }

        WsClientMsg::StartGame { room_id } => {
            // Only the owner can actually start
            let mut rooms = state.rooms.lock().await;
            if let Some(room_state) = rooms.get_mut(&room_id) {
                let caller = my_player_id.as_ref().unwrap();
                if *caller != room_state.owner {
                    let err = WsServerMsg::Error {
                        room_id: Some(room_id.clone()),
                        msg: "Only owner can start".to_string(),
                    };
                    let _ = ws
                        .send(Message::Text(serde_json::to_string(&err).unwrap().into()))
                        .await;
                    return;
                }

                // If a previous game is running, abort its timer so we can start fresh:
                if let Some(handle) = room_state.timer_handle.take() {
                    let _ = handle.abort();
                }

                // Generate a random board: e.g. 17×10 with values 1–9
                let mut board: BoardData = Vec::new();
                for _y in 0..ROWS {
                    for _x in 0..COLS {
                        let val = 1 + rand::random::<u8>() % 9;
                        board.push(val);
                    }
                }
                room_state.board = Some(board.clone());

                // Reset all players’ scores
                for pid in room_state.players.keys() {
                    room_state.scores.insert(pid.clone(), 0);
                }

                // Broadcast a GameStarted message to all in room
                let start_msg = WsServerMsg::GameStarted {
                    room_id: room_id.clone(),
                    board: board.clone(),
                    duration_secs: GAME_DURATION_SECS,
                };
                let _ = room_state.tx.send(start_msg);

                // Spawn a timer task that ticks every second (or ms) for GAME_DURATION_SECS
                let tx_clone = room_state.tx.clone();
                let room_clone = room_id.clone();
                let top_10_arc = state.top_10.clone();
                let rooms_clone = state.rooms.clone();
                let handle = tokio::spawn(async move {
                    // let start_time = Instant::now();
                    for sec_left in (0..=GAME_DURATION_SECS).rev() {
                        let tick = WsServerMsg::TimerTick {
                            room_id: room_clone.clone(),
                            remaining_secs: sec_left,
                        };
                        let _ = tx_clone.send(tick);
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                    {
                        let mut top_10 = top_10_arc.lock().await;
                        let mut rooms = rooms_clone.lock().await;
                        if let Some(room_state) = rooms.get_mut(&room_id) {
                            for (pid, score) in room_state.scores.iter() {
                                if let Some(player) = room_state.players.get(pid) {
                                    top_10.push((std::cmp::Reverse(*score), player.name.clone()));
                                    if top_10.len() > 10 {
                                        top_10.pop(); // maintain only top 10
                                    }
                                }
                            }

                            AppState::save_top_10(&top_10).await;
                        }
                    }
                    // When timer ends (sec_left hits 0 and we sleep one last second),
                    // we might want to broadcast a final LeaderboardUpdate or “game over.”
                    // For simplicity, do nothing here (clients will see timer = 0).
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
        }

        WsClientMsg::ScoreUpdate {
            room_id,
            player_id,
            cleared_count,
        } => {
            let mut rooms = state.rooms.lock().await;
            if let Some(room_state) = rooms.get_mut(&room_id) {
                if !room_state.players.contains_key(&player_id) {
                    let err = WsServerMsg::Error {
                        room_id: Some(room_id.clone()),
                        msg: "Not in room".to_string(),
                    };
                    let _ = ws
                        .send(Message::Text(serde_json::to_string(&err).unwrap().into()))
                        .await;
                    return;
                }

                // Add the cleared_count to that player’s total
                let entry = room_state.scores.entry(player_id.clone()).or_insert(0);
                *entry += cleared_count;

                // Broadcast updated leaderboard AND (optionally) current board
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
                let err = WsServerMsg::Error {
                    room_id: Some(room_id.clone()),
                    msg: "Room not found".to_string(),
                };
                let _ = ws
                    .send(Message::Text(serde_json::to_string(&err).unwrap().into()))
                    .await;
            }
        }

        WsClientMsg::ChatMessage {
            room_id,
            player_id: _,
            message,
        } => {
            let player_id = match my_player_id {
                Some(pid) => pid.clone(),
                None => {
                    let err = WsServerMsg::Error {
                        room_id: Some(room_id.clone()),
                        msg: "Player not identified".to_string(),
                    };
                    let _ = ws
                        .send(Message::Text(serde_json::to_string(&err).unwrap().into()))
                        .await;
                    return;
                }
            };

            let mut rooms = state.rooms.lock().await;
            if let Some(room_state) = rooms.get_mut(&room_id) {
                if let Some(player) = room_state.players.get(&player_id) {
                    let chat_msg = WsServerMsg::ChatBroadcast {
                        room_id: room_id.clone(),
                        player: player.clone(),
                        message: message.clone(),
                    };
                    let _ = room_state.tx.send(chat_msg);
                } else {
                    let err = WsServerMsg::Error {
                        room_id: Some(room_id.clone()),
                        msg: "You are not a player in this room".to_string(),
                    };
                    let _ = ws
                        .send(Message::Text(serde_json::to_string(&err).unwrap().into()))
                        .await;
                }
            } else {
                let err = WsServerMsg::Error {
                    room_id: Some(room_id.clone()),
                    msg: "Room not found".to_string(),
                };
                let _ = ws
                    .send(Message::Text(serde_json::to_string(&err).unwrap().into()))
                    .await;
            }
        }
    }
}

/// If a client disconnects without properly leaving the room, remove them from room state.
/// If they were the owner, you could optionally dissolve the room or pick a new owner.
async fn remove_player_from_room(room_id: &RoomId, player_id: &PlayerId, state: &AppState) {
    let mut rooms = state.rooms.lock().await;
    if let Some(room_state) = rooms.get_mut(room_id) {
        room_state.players.remove(player_id);
        room_state.scores.remove(player_id);
        // Broadcast new player list
        let players: Vec<_> = room_state.players.values().cloned().collect();
        let msg = WsServerMsg::RoomPlayersUpdate {
            room_id: room_id.clone(),
            players,
        };
        let _ = room_state.tx.send(msg);

        // (Optional) If owner left, you might decide to end the game or hand off ownership
        if &room_state.owner == player_id {
            // e.g. pick the next player as owner, or remove the room entirely:
            // let new_owner = room_state.players.iter().next().cloned();
            // room_state.owner = new_owner.unwrap_or_default(); or drop entire room.
        }

        // If no players remain, destroy the room
        if room_state.players.is_empty() {
            // cancel timer if still running
            if let Some(handle) = room_state.timer_handle.take() {
                let _ = handle.abort();
            }
            rooms.remove(room_id);
        }
    }
}
