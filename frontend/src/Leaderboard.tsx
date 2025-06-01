import { type Player } from "./types/ws";
import "./App.css";

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
    <table className="leaderboard">
      <thead>
        <tr>
          <th>Player</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.pid} className={r.pid === myId ? "me" : ""}>
            <td>{r.name}</td>
            <td>{r.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}