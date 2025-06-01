import  { useState } from "react";
import { useGameSocket } from "./gameSocket";
import Board from "./Board";
import Leaderboard from "./Leaderboard";
import Chat from "./Chat";

export default function App() {
  // Ask the user for a display name on page load
  const [name] = useState<string>(() => prompt("Enter your name")?.trim() || "anon");

  // Hook that manages WebSocket and game state
  const {
    roomId,
    players,
    board,
    scores,
    timer,
    error,
    createRoom,
    joinRoom,
    startGame,
    reportScore,
    myId,
    chatMessages,
    sendChatMessage,
  } = useGameSocket(name);

  // Local state for “join room” input field:
  const [joinInput, setJoinInput] = useState("");

  return (
    <div className="wrapper">
      <h1>🍏 Fruitbox Multiplayer</h1>
      <p>Your name: <b>{name}</b></p>

      {!roomId ? (
        <div className="lobby">
          <button onClick={() => createRoom()}>Create Room</button>
          <span> or join room </span>
          <input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            placeholder="Room ID"
          />
          <button onClick={() => joinRoom(joinInput.trim())}>Join</button>
        </div>
      ) : (
        <div className="lobby">
          <p>
            <b>Room ID:</b> {roomId} &nbsp;|&nbsp; 
            <b>Players:</b> {players.map((p) => p.name).join(", ")}
          </p>
          <button onClick={() => startGame()}>Start Game</button>
        </div>
      )}

      {error && <p className="error">Error: {error}</p>}

      {roomId && myId && (
        <div className="chat-container" style={{ marginTop: "1rem" }}>
          {/* Pass chatMessages and sendChatMessage to ChatBox */}
          <Chat
            chatMessages={chatMessages}
            sendChatMessage={sendChatMessage}
          />
        </div>
      )}

      {board.length > 0 && (
        <div>
          <p>Time Remaining: {timer} s</p>
          <Board
            board={board}
            onClear={(count) => reportScore(count)}
            disabled={timer === 0}
            rows={10}
            cols={17}
          />
          <Leaderboard players={players} scores={scores} myId={myId} />
        </div>
      )}
    </div>
  );
}