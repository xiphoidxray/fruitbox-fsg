import clsx from "clsx";

export interface AppleProps {
  x: number;          // grid column
  y: number;          // grid row
  value: number;
  selected: boolean;
  cleared: boolean;
}

export default function Apple({ x, y, value, selected, cleared }: AppleProps) {
  return (
    <div
      className={clsx("apple", { selected, cleared })}
      style={{
        gridColumnStart: x + 1, // CSS grid is 1-based
        gridRowStart: y + 1,
      }}
    >
      {value}
    </div>
  );
}
