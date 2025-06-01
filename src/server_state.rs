// src/server_state.rs
use crate::ws_messages::{BoardData, Player, PlayerId, RoomId, WsServerMsg};
use std::{
    collections::{BinaryHeap, HashMap},
    sync::Arc,
};
use tokio::sync::{broadcast, Mutex};

/// How long (in seconds) the game runs after StartGame.
pub const GAME_DURATION_SECS: u64 = 120;

/// Represents everything the server needs to know about a single lobby/room.
#[derive(Debug)]
pub struct RoomState {
    pub owner: PlayerId,
    pub players: HashMap<PlayerId, Player>,

    // broadcast channel so we can send WsServerMsg to *all* participants.
    pub tx: broadcast::Sender<WsServerMsg>,

    // After the game starts:
    pub board: Option<BoardData>,
    pub scores: HashMap<PlayerId, u32>,

    // so we can cancel a running timer if needed (e.g. room closed).
    // For simplicity, we’ll store a handle to the tokio::JoinHandle.
    pub timer_handle: Option<tokio::task::JoinHandle<()>>,
}

impl RoomState {
    pub fn new(owner: Player) -> Self {
        let (tx, _) = broadcast::channel(32);
        let mut players = HashMap::new();
        players.insert(owner.player_id.clone(), owner.clone());
        RoomState {
            owner: owner.player_id,
            players,
            tx,
            board: None,
            scores: HashMap::new(),
            timer_handle: None,
        }
    }
}

/// Global application state: all rooms, keyed by ID.
#[derive(Clone)]
pub struct AppState {
    /// Mutex so we can add/remove rooms, modify players, etc.
    pub rooms: Arc<Mutex<HashMap<RoomId, RoomState>>>,
    pub top_10: Arc<Mutex<BinaryHeap<(u32, String)>>>, // (score, player name)
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            rooms: Arc::new(Mutex::new(HashMap::new())),
            top_10: Arc::new(Mutex::new(BinaryHeap::new())),
        }
    }
}
