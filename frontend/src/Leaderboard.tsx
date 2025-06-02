import { type Player } from "./types/ws";

interface LeaderboardProps {
  players: Player[];
  scores: Record<string, number>;
  myId: string | null;
}

export default function Leaderboard({ players, scores, myId }: LeaderboardProps) {
  // Build an array of { name, pid, score }:
  const rows = players.map((p) => ({
    name: p.name,
    pid: p.player_id,
    score: scores[p.player_id] ?? 0,
  }));
  
  // Sort descending
  rows.sort((a, b) => b.score - a.score);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">
        Scores
      </h3>
      
      <div className="space-y-2">
        {rows.map((player, index) => {
          const isMe = player.pid === myId;
          return (
            <div
              key={player.pid}
              className={`flex items-center justify-between p-3 rounded-lg ${
                isMe 
                  ? 'bg-blue-100 border-2 border-blue-300' 
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-600 w-8">
                  #{index + 1}
                </span>
                <span className={`font-medium ${isMe ? 'text-blue-800' : 'text-gray-800'}`}>
                  {player.name}
                  {isMe && <span className="text-blue-600 text-sm ml-1">(You)</span>}
                </span>
              </div>
              
              <span className={`font-bold ${isMe ? 'text-blue-600' : 'text-gray-700'}`}>
                {player.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}