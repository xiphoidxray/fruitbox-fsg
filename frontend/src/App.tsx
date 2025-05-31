import { useState, useRef } from "react";
import Apple from "./Apple";
import "./App.css";

type AppleState = {
  x: number;
  y: number;
  value: number;
  cleared: boolean;
};

const COLS = 17;
const ROWS = 10;

/** Generate a fresh board of apples with values 1-9 */
function genApples(): AppleState[] {
  const apples: AppleState[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      apples.push({
        x,
        y,
        value: 1 + Math.floor(Math.random() * 9),
        cleared: false,
      });
    }
  }
  return apples;
}

export default function App() {
  const [apples, setApples] = useState(() => genApples());
  const [score, setScore] = useState(0);

  // drag state
  const start = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  /** Convert mouse px coords to grid cell indices */
  const posToCell = (e: React.PointerEvent) => {
    const board = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = e.clientX - board.left;
    const relY = e.clientY - board.top;
    return {
      x: Math.floor(relX / (board.width / COLS)),
      y: Math.floor(relY / (board.height / ROWS)),
    };
  };

  /** Begin drag */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const cell = posToCell(e);
    start.current = cell;
    setRect({ x1: cell.x, y1: cell.y, x2: cell.x, y2: cell.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  /** Update drag rectangle */
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const cell = posToCell(e);
    setRect({
      x1: Math.min(start.current.x, cell.x),
      y1: Math.min(start.current.y, cell.y),
      x2: Math.max(start.current.x, cell.x),
      y2: Math.max(start.current.y, cell.y),
    });
  };

  /** End drag – compute sum & maybe clear */
  const onPointerUp = () => {
    if (!rect) return;
    const sel = (a: AppleState) =>
      !a.cleared &&
      a.x >= rect.x1 &&
      a.x <= rect.x2 &&
      a.y >= rect.y1 &&
      a.y <= rect.y2;

    const sum = apples.filter(sel).reduce((acc, a) => acc + a.value, 0);

    if (sum === 10) {
      setApples((prev) =>
        prev.map((a) => (sel(a) ? { ...a, cleared: true } : a))
      );
      setScore((s) => s + apples.filter(sel).length);
    }

    // reset drag overlay
    start.current = null;
    setRect(null);
  };

  return (
    <div className="wrapper">
      <h1>🍏 Sum-to-10 Game</h1>
      <p>Score: {score}</p>

      <div
        className="board"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {apples.map((a, i) => (
          <Apple
            key={i}
            {...a}
            selected={
              !!rect &&
              !a.cleared &&
              a.x >= rect.x1 &&
              a.x <= rect.x2 &&
              a.y >= rect.y1 &&
              a.y <= rect.y2
            }
          />
        ))}
        {rect && (
          <div
            className="drag-rect"
            style={{
              gridColumn: `${rect.x1 + 1} / ${rect.x2 + 2}`,
              gridRow: `${rect.y1 + 1} / ${rect.y2 + 2}`,
            }}
          />
        )}
      </div>

      <button onClick={() => { setApples(genApples()); setScore(0); }}>
        Reset
      </button>
    </div>
  );
}