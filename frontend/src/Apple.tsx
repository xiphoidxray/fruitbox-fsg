import clsx from "clsx";

export interface AppleProps {
  x: number;
  y: number;
  value: number;
  selected: boolean;
  cleared: boolean;
}

export default function Apple({
  x,
  y,
  value,
  selected,
  cleared,
}: AppleProps) {
  return (
    <div
      className={clsx("apple", { selected, cleared })}
      style={{
        gridColumnStart: x + 1,
        gridRowStart: y + 1,
      }}
    >
      {value}
    </div>
  );
}
