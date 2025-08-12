// src/ws_messages.rs

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// The dimensions of our game board.
pub const ROWS: usize = 10;
pub const COLS: usize = 17;
pub const BOARD_SIZE: usize = ROWS * COLS;

/// A full “sum‐to‐10” board is now just a flat array of 170 `u8`s (values 1..=9).
/// Index calculation on the front end is: `index = y * COLS + x`.
pub type BoardData = Vec<u8>;

/// A globally unique ID for a room (we use a UUID string).
pub type RoomId = String;

/// A globally unique ID for a player (UUID string).
pub type PlayerId = String;

/// Represents one connected player (UUID and chosen display name).
#[derive(Serialize, Deserialize, TS, Debug, Clone)]
#[ts(export, export_to = "../frontend/src/types/ws.ts")]
pub struct Player {
    /// The server‐assigned unique ID (e.g. a UUID).
    pub player_id: PlayerId,
    /// The display name the player typed in (e.g. “Alice”).
    pub name: String,
    /// Whether if the player is ready for the current game to start.
    pub ready: bool,
}

/// All messages the **front end** can send to the server.
#[derive(Serialize, Deserialize, TS, Debug, Clone)]
#[serde(tag = "type", content = "data")]
#[ts(export, export_to = "../frontend/src/types/ws.ts")]
pub enum WsClientMsg {
    /// Client wants to create a new room. Sends their `Player` (name + a client‐generated `player_id` or `""`).
    CreateRoom {
        player: Player,
    },

    /// Client wants to join an existing room: the `room_id` and their `Player` (with `player_id=""` if they don’t have one yet).
    JoinRoom {
        room_id: RoomId,
        player: Player,
    },

    /// Only the room’s owner can issue this once everyone has joined.
    /// Server will generate and broadcast a `BoardData`.
    StartGame {
    },

    /// Whenever a client clears some apples, it reports how many it just cleared.
    ScoreUpdate {
        // room_id: RoomId,
        // player_id: PlayerId,
        cleared_count: u32,
        turn: u32,
    },

    ReadyUp {
        ready: bool,
    },

    /// Player sends a chat message to everyone in the room.
    ChatMessage {
        // room_id: RoomId,
        // player_id: PlayerId,
        message: String,
    },
}

/// All messages the **server** can push back to every client in a room.
#[derive(Serialize, Deserialize, TS, Debug, Clone)]
#[serde(tag = "type", content = "data")]
#[ts(export, export_to = "../frontend/src/types/ws.ts")]
pub enum WsServerMsg {
    /// A new room was created. Server returns the `room_id` and the `Player` (with assigned `player_id`).
    RoomCreated { room_id: RoomId },

    // /// Broadcast to that client (and any later joiners) the full current room info:
    // /// room ID and the list of current players (their `Player` structs).
    // JoinedRoom {
    //     room_id: RoomId,
    //     players: Vec<Player>,
    // },
    /// Broadcast whenever anyone joins or leaves so UIs can update their lobby list.
    RoomPlayersUpdate {
        room_id: RoomId,
        players: Vec<Player>,
        owner_id: PlayerId, // who is the room owner
    },

    /// Sent once when the owner hits “Start Game.” Contains an array of 170 u8s (1..=9).
    GameStarted {
        room_id: RoomId,
        board: BoardData,
        duration_secs: u64, // e.g. 60
    },

    /// Sent once per second so clients can update their countdown timer.
    TimerTick {
        // room_id: RoomId,
        remaining_secs: u64,
    },

    /// Sent whenever anyone’s score changes (or on initial GameStarted if you prefer).
    /// `scores` is a Vec of `(PlayerId, u32)` pairs. The front‐end can merge this with its `players` list.
    LeaderboardUpdate {
        room_id: RoomId,
        scores: Vec<(PlayerId, u32)>,
    },

    /// Server broadcasts a chat message to all players in the room.
    ChatBroadcast {
        room_id: RoomId,
        player: Player,
        message: String,
    },

    /// Used to notify of any error: invalid room, not owner, etc.
    Error {
        room_id: Option<RoomId>,
        msg: String,
    },

    /// Sent to newly connected clients (before joining a room), showing the global top 10 scores.
    Top10Scores {
        scores: Vec<(u32, String)>, // (player_name, score)
    },
}
