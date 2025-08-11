import type { Player } from "./types";
// import appleImage from "./applev2.png";

interface GameLobbyProps {
  roomId: string | null;
  players: Player[];
  joinInput: string;
  setJoinInput: (value: string) => void;
  createRoom: () => void;
  joinRoom: (roomId: string) => void;
  startGame: () => void;
  readyUp: (ready: boolean) => void;
  myId: string;
  ownerId: string;
  isOwner: boolean;
}

export default function GameLobby({
  roomId,
  players,
  joinInput,
  setJoinInput,
  createRoom,
  joinRoom,
  startGame,
  readyUp,
  myId,
  ownerId,
  isOwner,
}: GameLobbyProps) {
  return (
    <>
      {/* Home Button fixed to top left */}
      <button
        onClick={() => window.location.reload()}
        className="fixed top-4 left-4 z-50 p-4 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition-colors duration-200 group flex items-center justify-center shadow w-16 h-16"
        title="Go to Home"
      >
        {/* Home Icon SVG */}
        <svg 
          className="w-8 h-8" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M3 9.75L12 4l9 5.75M4.5 10.75V19a1 1 0 001 1h3.5a1 1 0 001-1v-4.25a1 1 0 011-1h2a1 1 0 011 1V19a1 1 0 001 1h3.5a1 1 0 001-1v-8.25" 
          />
        </svg>
      </button>

      <div className="flex-1">
        <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-green-300">
          

          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-green-800 mb-2">
              🎮 Game Lobby
            </h3>
            <p className="text-green-600">
              Create a new room or join an existing one:
            </p>
          </div>

          {/* If no room yet, show create/join controls */}
          {!roomId ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => {
                  console.log("UI: Create New Room button clicked");
                  createRoom();
                }}
                className="bg-green-500 hover:bg-green-600 text-...">
                Create New Room
              </button>

              <div className="flex items-center gap-3">
                <span className="text-green-700 font-medium">or</span>
                <input
                  className="border-2 border-green-300 bg-white px-4 py-2 rounded-full text-center font-medium text-green-800 placeholder-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all duration-200"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  placeholder="Room ID"
                />
                <button
                  onClick={() => joinRoom(joinInput.trim())}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-3 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  Join Room
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Once a room is created/joined, keep showing Room ID and players here */}
              <div className="bg-green-50 p-4 rounded-xl border-green-200 mb-4">
                <div className="text-center mb-3">
                  <div className="inline-flex items-center bg-white px-6 py-3 rounded-lg shadow-sm border border-green-300">
                    <span className="text-lg font-bold text-green-800">
                      Room: <span className="text-red-600 bg-red-100 px-3 py-1 rounded ml-2">{roomId}</span>
                    </span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-green-200 mb-4">
                  <h4 className="text-green-700 font-bold text-center mb-3">Players in Room</h4>
                  <div className="flex flex-wrap justify-center gap-3">
                    {players.map((player, idx) => (
                      <div
                        key={idx}
                        className="bg-green-100 px-4 py-2 rounded-lg border border-green-300 flex items-center gap-2"
                      >
                        <span className="font-bold text-green-800">
                          {player.name}
                          {player.player_id === ownerId && (
                            <span className="text-purple-600 text-xs ml-1 font-normal">(owner)</span>
                          )}
                        </span>
                        {/* Show checkmark for ready players, but not for owner */}
                        {player.player_id !== ownerId && player.ready && (
                          <span className="text-green-600 text-sm">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {players.length < 2 && (
                    <p className="text-center text-green-600 text-sm mt-3 italic">
                      Waiting for more players to join...
                    </p>
                  )}
                </div>

                {/* Show Start Game button to owner, Ready Up button to others */}
                <div className="text-center">
                  {isOwner ? (
                    <button
                      onClick={() => startGame()}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-3 rounded-lg shadow-sm transition-colors duration-200 border border-purple-700"
                    >
                      Start Game
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        // Toggle ready state
                        const currentPlayer = players.find(p => p.player_id === myId);
                        const newReadyState = !currentPlayer?.ready;
                        readyUp(newReadyState);
                      }}
                      className={`px-8 py-3 rounded-lg shadow-sm transition-colors duration-200 font-bold ${
                        players.find(p => p.player_id === myId)?.ready
                          ? "bg-red-500 hover:bg-red-600 text-white border border-red-600"
                          : "bg-green-500 hover:bg-green-600 text-white border border-green-600"
                      }`}
                    >
                      {players.find(p => p.player_id === myId)?.ready ? "Not Ready" : "Ready Up!"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
} 