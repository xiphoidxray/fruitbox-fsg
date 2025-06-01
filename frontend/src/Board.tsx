// src/Board.tsx
import React, { useEffect, useRef, useState } from "react";
import Apple from "./Apple";
import "./App.css";

interface BoardProps {
  board: number[];               // a flat array of length rows * cols
  onClear: (count: number) => void;
  disabled: boolean;
  rows: number;                  // e.g. 10
  cols: number;                  // e.g. 17
}

/** 
 * We keep a local “AppleState” for each cell so that toggling `cleared` is a single
 * array‐map operation rather than a Set lookup per render.
 */
type AppleState = {
  x: number;       // column index 0..cols-1
  y: number;       // row index   0..rows-1
  value: number;   // 1..9
  cleared: boolean;
};

export default function Board({
  board,
  onClear,
  disabled,
  rows,
  cols,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);

  /** Local array of length rows*cols, holding state for each apple. */
  const [apples, setApples] = useState<AppleState[]>([]);

  /** Re‐generate apples[] whenever the prop `board` changes (new game). */
  useEffect(() => {
    const arr: AppleState[] = [];
    for (let i = 0; i < board.length; i++) {
      const x = i % cols;
      const y = Math.floor(i / cols);
      arr.push({
        x,
        y,
        value: board[i],
        cleared: false,
      });
    }
    setApples(arr);
  }, [board, cols]);

  /** Current drag rectangle in board‐relative px coords, or null if not dragging. */
  const [rectPx, setRectPx] =
    useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
      null
    );

  /** Refs for tracking drag start and cached cell dimensions. */
  const startPx = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  /** We only call getBoundingClientRect() once per drag‐start and store results here. */
  const bboxRef = useRef<DOMRect | null>(null);
  const cellSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  /** Convert pointer event into board‐relative pixel coords. */
  const relPos = (e: React.PointerEvent) => {
    const box = boardRef.current!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };

  /** Begin drag: measure bounding box, compute cell size, and start a new rect. */
  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    const box = boardRef.current!.getBoundingClientRect();
    bboxRef.current = box;
    cellSizeRef.current = {
      w: box.width / cols,
      h: box.height / rows,
    };

    const p = relPos(e);
    startPx.current = p;
    dragging.current = true;
    setRectPx({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  /** Update rect as the user drags. We do not re‐measure the board here. */
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

  /**
   * On pointer up: 
   * 1) Determine which apples’ centers are inside rectPx (skip already cleared). 
   * 2) Sum their values; if exactly 10, mark them all cleared in one setApples() call.
   * 3) Use requestAnimationFrame to clear the drag rectangle so React can batch updates.
   */
  const onPointerUp = () => {
    if (!rectPx || !bboxRef.current) {
      dragging.current = false;
      return;
    }

    const { w: cellW, h: cellH } = cellSizeRef.current;

    /** Return true if the apple’s center is inside current rectPx AND not yet cleared. */
    const isInside = (a: AppleState) => {
      if (a.cleared) return false;
      const cx = (a.x + 0.5) * cellW;
      const cy = (a.y + 0.5) * cellH;
      return (
        cx >= rectPx.x1 &&
        cx <= rectPx.x2 &&
        cy >= rectPx.y1 &&
        cy <= rectPx.y2
      );
    };

    // Filter all un‐cleared apples that fall inside rectPx
    const picked = apples.filter(isInside);
    const sum = picked.reduce((acc, a) => acc + a.value, 0);

    if (sum === 10 && picked.length > 0) {
      // Mark those apples as cleared in one pass
      setApples((prev) =>
        prev.map((a) => (isInside(a) ? { ...a, cleared: true } : a))
      );
      onClear(picked.length);
    }

    // Hide the drag‐rectangle on the next animation frame, so React can
    // batch the cleared‐apple update and the rectangle removal into one paint.
    requestAnimationFrame(() => {
      setRectPx(null);
      dragging.current = false;
      bboxRef.current = null;
    });
  };

  return (
    <div
      className="board"
      ref={boardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/** Render each apple. We only call getBoundingClientRect() here if rectPx != null. **/}
      {apples.map((a, i) => {
        let selected = false;
        if (rectPx && !a.cleared && bboxRef.current) {
          const { w: cellW, h: cellH } = cellSizeRef.current;
          const cx = (a.x + 0.5) * cellW;
          const cy = (a.y + 0.5) * cellH;
          selected =
            cx >= rectPx.x1 &&
            cx <= rectPx.x2 &&
            cy >= rectPx.y1 &&
            cy <= rectPx.y2;
        }

        return (
          <Apple
            key={i}
            x={a.x}
            y={a.y}
            value={a.value}
            selected={selected}
            cleared={a.cleared}
          />
        );
      })}

      {/** Draw the translucent drag rectangle on top **/}
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
  );
}