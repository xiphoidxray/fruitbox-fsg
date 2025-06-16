import { useState, useEffect } from "react";
import { useGameSocket } from "./gameSocket";
import Board from "./Board";
import Chat from "./Chat";
import GameEndPopup from "./Popup";
import Leaderboard from "./Leaderboard";
import { Toaster } from "react-hot-toast";
import appleImage from "./applev2.png"; // adjust path as needed
import appleHighlightedImage from "./applev2-highlighted.png"; // highlighted apple image
import MainTitle from "./MainTitle";
import GameLobby from "./GameLobby";


export default function App() {
  const [name] = useState<string>(() => {
    // Try to get name from localStorage
    const storedName = localStorage.getItem("playerName");
    if (storedName) return storedName;

    // If not found, prompt and save it
    const enteredName = prompt("Enter your name")?.trim() || "anon";
    if (enteredName != "anon") {
      localStorage.setItem("playerName", enteredName);
    }
    return enteredName;
  });
  const [joinInput, setJoinInput] = useState("");
  const [showGameEndPopup, setShowGameEndPopup] = useState(false);

  const {
    roomId,
    players,
    board,
    scores,
    timer,
    createRoom,
    joinRoom,
    readyUp, // Add readyUp from useGameSocket
    startGame,
    reportScore,
    myId,
    chatMessages,
    sendChatMessage,
    top10Scores,
    ownerId,
  } = useGameSocket(name);

  // Track previous timer value to detect when game actually ends
  const [prevTimer, setPrevTimer] = useState<number | null>(null);
  const [gameHasEnded, setGameHasEnded] = useState(false);

  // Check for game end (when timer reaches 0 from a positive number)
  useEffect(() => {
    if (roomId && board.length > 0) {
      // Game just ended if timer is 0 and previous timer was > 0
      if (timer === 0 && prevTimer! > 0 && !gameHasEnded) {
        setGameHasEnded(true);

        // Show popup after a short delay to let the timer update
        setTimeout(() => {
          setShowGameEndPopup(true);
        }, 500);
      }

      // Reset game end flag when a new game starts (timer goes from 0 to positive)
      if (timer > 0 && prevTimer === 0) {
        setGameHasEnded(false);
      }
    }

    // Update previous timer
    setPrevTimer(timer);
  }, [timer, roomId, board.length, scores, myId, players, prevTimer, gameHasEnded]);

  // Check if game is active (board has been set up)
  const isGameActive = roomId && board.length > 0;

  // Check if current user is owner
  const isOwner = myId === ownerId;

  // Lobby/Menu Page
  if (!isGameActive) {
    return (
      <>
        <Toaster />
        <img
          src={appleHighlightedImage}
          alt=""
          className="aboslute hidden"
        />
        <img
          src={appleImage}
          alt=""
          className="aboslute hidden"
        />
        <div className="flex w-screen flex-col min-h-screen items-center justify-center p-4 bg-gradient-to-br from-green-100 to-green-200 relative">
          {/* Checkered pattern overlay */}
          <div
            className="absolute inset-0 opacity-10 bg-white"
            style={{
              backgroundImage: `repeating-conic-gradient(#fff 0% 25%, transparent 25% 50%)`,
              backgroundSize: "20px 20px",
            }}
          ></div>


          <div className="relative z-10 w-full max-w-6xl">
            {/* Main Title */}
            {board.length === 0 && <MainTitle name={name} />}

            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Game Lobby */}
                <GameLobby
                  roomId={roomId}
                  players={players}
                  joinInput={joinInput}
                  setJoinInput={setJoinInput}
                  createRoom={createRoom}
                  joinRoom={joinRoom}
                  startGame={startGame}
                  readyUp={readyUp}
                  myId={myId}
                  ownerId={ownerId}
                  isOwner={isOwner}
                />

                {/* Chat replaces the leaderboard - only show when we have a room */}
                {roomId && myId && (
                  <div className="lg:w-80">
                    <div className="bg-white rounded-xl shadow-lg border border-green-200 h-full flex flex-col">
                      <div className="bg-green-50 px-4 py-3 rounded-t-xl border-b border-green-200">
                        <h2 className="text-lg font-bold text-green-800 text-center">
                          Chat
                        </h2>
                      </div>
                      <div className="flex-1 p-4">
                        <Chat chatMessages={chatMessages} sendChatMessage={sendChatMessage} maxHeight={"23rem"} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Top 10 leaderboard - only show when no room */}
                {top10Scores.length > 0 && !roomId && (
                  <div className="lg:w-80">
                    <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-green-300 h-full">
                      <div className="text-center mb-4">
                        <h2 className="text-lg font-bold text-green-800">
                          Top 10 Scores
                        </h2>
                      </div>
                      <div className="space-y-2">
                        {top10Scores.slice(0, 3).map((entry, index) => (
                          <div
                            key={index}
                            className={`flex items-center justify-between p-3 rounded-lg shadow-sm transform hover:scale-105 transition-transform duration-200 ${index === 0
                              ? "bg-red-100 border border-red-300"
                              : index === 1
                                ? "bg-green-100 border border-green-300"
                                : "bg-orange-100 border border-orange-300"
                              }`}
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">
                                {index === 0 ? "🍎" : index === 1 ? "🍏" : "🍊"}
                              </span>
                              <span className="font-bold text-sm text-gray-800">
                                {entry.name}
                              </span>
                            </div>
                            <div className="bg-white px-2 py-1 rounded-full shadow-sm">
                              <span className="font-bold text-sm text-gray-800">
                                {entry.score}
                              </span>
                            </div>
                          </div>
                        ))}

                        {top10Scores.length > 3 && (
                          <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                            {top10Scores.slice(3).map((entry, index) => (
                              <div
                                key={index + 3}
                                className="flex items-center justify-between p-2 bg-green-50 rounded-md hover:bg-green-100 transition-colors duration-200"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                    {index + 4}
                                  </span>
                                  <span className="font-medium text-gray-700 text-sm">
                                    {entry.name}
                                  </span>
                                </div>
                                <span className="font-bold text-gray-700 bg-white px-2 py-1 rounded-full text-xs shadow-sm">
                                  {entry.score}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Game Page (when game is active)
  return (
    <>
      <Toaster />

      {/* Game End Popup */}
      <GameEndPopup
        isOpen={showGameEndPopup}
        onClose={() => {
          setShowGameEndPopup(false);
          setGameHasEnded(false); // Reset the game ended flag
        }}
        myScore={scores[myId]}
      />

      <div className="min-h-screen bg-white flex flex-col w-screen">
        {/* Compact Room Header */}
        <div className="bg-gray-50 border-gray-200 p-4 relative">
          {/* Home Button - positioned absolutely in top-left corner */}
          <button
            onClick={() => window.location.reload()}
            className="absolute top-4 left-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors duration-200 group"
            title="Go to Home"
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
              />
            </svg>
          </button>

          <div className="max-w-full mx-auto flex flex-col sm:flex-row items-center justify-between pl-12">
            {/* Room ID and Players */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="flex items-center px-4 py-2 rounded-lg border-gray-300">
                <span className="text-sm font-bold text-gray-700">
                  Room: <span className="text-red-600 bg-gray-100 px-2 py-1 rounded ml-2 text-xs">{roomId}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Players:</span>
                <div className="flex gap-2">
                  {players.map((player, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1 rounded-md border-green-300 flex items-center gap-1"
                    >
                      <span className="text-sm font-medium text-green-800">
                        {player.name}
                        {player.player_id === ownerId && (
                          <span className="text-purple-600 text-xs ml-1 font-normal">(owner)</span>
                        )}
                      </span>
                      {/* Show checkmark for ready players, but not for owner */}
                      {player.player_id !== ownerId && player.ready && (
                        <span className="text-green-600 text-xs">✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Only show New Game button to owner */}
              {isOwner ? (
                <button
                  onClick={() => startGame()}
                  className="ml-4 bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-1 rounded-lg shadow-sm transition-colors duration-200 border border-purple-700"
                >
                  New Game
                </button>
              ) : (

                <button
                  onClick={() => {
                    // Toggle ready state
                    const currentPlayer = players.find(p => p.player_id === myId);
                    const newReadyState = !currentPlayer?.ready;
                    readyUp(newReadyState);
                  }}
                  className={`ml-4 px-4 py-1 rounded-lg shadow-sm transition-colors duration-200 font-bold text-sm ${players.find(p => p.player_id === myId)?.ready
                    ? "bg-red-500 hover:bg-red-600 text-white border border-red-600"
                    : "bg-green-500 hover:bg-green-600 text-white border border-green-600"
                    }`}
                >
                  {players.find(p => p.player_id === myId)?.ready ? "Not Ready" : "Ready Up!"}
                </button>
              )}
            </div>

            {/* Timer */}
            <div
              className={`px-6 py-2 rounded-lg text-xl font-bold ${timer > 30
                ? "bg-green-100 text-green-800"
                : timer > 10
                  ? "bg-orange-100 text-orange-800"
                  : "bg-red-100 text-red-800"
                }`}
            >
              {timer}s
            </div>
          </div>
        </div>

        {/* Game Content */}
        <div className="flex-1 flex max-w-7xl mx-auto">
          {/* Game Board Area */}
          <div className="flex-1 p-6">
            <div className="bg-white rounded-lg border-gray-200 p-6">
              <div className="inline-block">
                <div className="flex flex-col">
                  <Board
                    board={board}
                    onClear={(count) => reportScore(count)}
                    disabled={timer === 0}
                    rows={10}
                    cols={17}
                  />
                  <div className="mt-6">
                    <Leaderboard players={players} scores={scores} myId={myId} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Sidebar */}
          <div className="w-80 p-6 pl-0 mt-10">
            <div className="bg-white rounded-lg border border-gray-200 h-fit flex flex-col">
              <div className="bg-gray-50 px-4 py-3 rounded-t-lg border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-800 text-center">
                  Chat
                </h2>
              </div>
              <div className="flex-1 p-4">
                <Chat chatMessages={chatMessages} sendChatMessage={sendChatMessage} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}