// src/server_state.rs
use crate::ws_messages::{BoardData, Player, PlayerId, RoomId, WsServerMsg};
use serde::{Deserialize, Serialize};
use std::{
    cmp::Reverse,
    collections::{BinaryHeap, HashMap},
    path::Path,
    sync::Arc,
};
use tokio::{
    fs,
    sync::{broadcast, Mutex, MutexGuard},
};

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

    // Track number of turns per player
    pub turns: HashMap<PlayerId, u32>,

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
            turns: HashMap::new(),
            timer_handle: None,

        }
    }
}

/// Global application state: all rooms, keyed by ID.
#[derive(Clone)]
pub struct AppState {
    /// Mutex so we can add/remove rooms, modify players, etc.
    pub rooms: Arc<Mutex<HashMap<RoomId, RoomState>>>,
    pub top_10: Arc<Mutex<BinaryHeap<(Reverse<u32>, String)>>>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            rooms: Arc::new(Mutex::new(HashMap::new())),
            top_10: Arc::new(Mutex::new(BinaryHeap::new())),
        }
    }
    pub fn new_with_top_10(top_10: BinaryHeap<(Reverse<u32>, String)>) -> Self {
        AppState {
            rooms: Arc::new(Mutex::new(HashMap::new())),
            top_10: Arc::new(Mutex::new(top_10)),
        }
    }
    /// Load the top 10 from file asynchronously
    pub async fn load_top_10() -> BinaryHeap<(Reverse<u32>, String)> {
        let path = Path::new("top10.json");
        if let Ok(data) = fs::read_to_string(path).await {
            if let Ok(entries) = serde_json::from_str::<Vec<TopScoreEntry>>(&data) {
                let mut heap = BinaryHeap::new();
                for entry in entries {
                    heap.push((std::cmp::Reverse(entry.score), entry.name));
                }
                return heap;
            }
        }
        BinaryHeap::new()
    }

    /// Save the top 10 to file asynchronously
    pub async fn save_top_10(heap: &MutexGuard<'_, BinaryHeap<(Reverse<u32>, String)>>) {
        let vec: Vec<_> = heap
            .iter()
            .map(|r| TopScoreEntry {
                score: r.0 .0,
                name: r.1.clone(),
            })
            .collect();
        let data = serde_json::to_string_pretty(&vec).unwrap();
        println!("saving top 10 {:#?}", heap);
        let _ = fs::write("top10.json", data).await;
    }
}

#[derive(Serialize, Deserialize)]
pub struct TopScoreEntry {
    pub score: u32,
    pub name: String,
}

pub struct TurnsUpdate {
    pub room_id: RoomId,
   pub turns: HashMap<PlayerId, u32>,
},