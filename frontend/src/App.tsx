import { useRef, useState } from "react";
import Apple from "./Apple";
import "./App.css";

/* ---------- constants ---------- */
const COLS = 17;
const ROWS = 10;

/* ---------- helpers ---------- */
type AppleState = {
  x: number;
  y: number;
  value: number;
  cleared: boolean;
};

function genApples(): AppleState[] {
  const out: AppleState[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      out.push({
        x,
        y,
        value: 1 + Math.floor(Math.random() * 9),
        cleared: false,
      });
    }
  }
  return out;
}

/* ---------- component ---------- */
export default function App() {
  const [apples, setApples] = useState(() => genApples());
  const [score, setScore] = useState(0);

  const boardRef = useRef<HTMLDivElement>(null);

  /** live drag rectangle in *pixels* relative to board top-left */
  const [rectPx, setRectPx] =
    useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  /** drag bookkeeping */
  const startPx = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  /* convert absolute mouse event to board-relative pixels */
  const relPos = (e: React.PointerEvent) => {
    const box = boardRef.current!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };

  /* pointer handlers */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = relPos(e);
    startPx.current = p;
    dragging.current = true;
    setRectPx({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !startPx.current) return;
    const p = relPos(e);
    setRectPx({
      x1: Math.min(startPx.current.x, p.x),
      y1: Math.min(startPx.current.y, p.y),
      x2: Math.max(startPx.current.x, p.x),
      y2: Math.max(startPx.current.y, p.y),
    });
  };

  const onPointerUp = () => {
    if (!rectPx || !boardRef.current) return;
    dragging.current = false;

    const { width, height } = boardRef.current.getBoundingClientRect();
    const cellW = width / COLS;
    const cellH = height / ROWS;

    const inside = (a: AppleState) => {
      if (a.cleared) return false;
      const cx = (a.x + 0.5) * cellW;
      const cy = (a.y + 0.5) * cellH;
      return cx >= rectPx.x1 && cx <= rectPx.x2 && cy >= rectPx.y1 && cy <= rectPx.y2;
    };

    const picked = apples.filter(inside);
    const sum = picked.reduce((acc, a) => acc + a.value, 0);

    if (sum === 10 && picked.length) {
      setApples((prev) =>
        prev.map((a) => (inside(a) ? { ...a, cleared: true } : a)),
      );
      setScore((s) => s + picked.length);
    }

    // brief flash so user sees result
    setTimeout(() => setRectPx(null), 20);
  };

  /* ---------- ui ---------- */
  return (
    <div className="wrapper">
      <h1>🍏 Sum-to-10 Game</h1>
      <p>Score: {score}</p>

      <div
        ref={boardRef}
        className="board"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {apples.map((a, i) => {
          let selected = false;
          if (rectPx && boardRef.current && !a.cleared) {
            const { width, height } = boardRef.current.getBoundingClientRect();
            const cw = width / COLS;
            const ch = height / ROWS;
            const cx = (a.x + 0.5) * cw;
            const cy = (a.y + 0.5) * ch;
            selected =
              cx >= rectPx.x1 &&
              cx <= rectPx.x2 &&
              cy >= rectPx.y1 &&
              cy <= rectPx.y2;
          }
          return <Apple key={i} {...a} selected={selected} />;
        })}

        {rectPx && (
          <div
            className="drag-rect"
            style={{
              left: rectPx.x1,
              top: rectPx.y1,
              width: rectPx.x2 - rectPx.x1,
              height: rectPx.y2 - rectPx.y1,
            }}
          />
        )}
      </div>

      <button
        onClick={() => {
          setApples(genApples());
          setScore(0);
          setRectPx(null);
        }}
      >
        Reset
      </button>
    </div>
  );
}
