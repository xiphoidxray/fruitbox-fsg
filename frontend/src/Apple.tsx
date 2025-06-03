import React from "react";
import appleImage from "./applev2.png"; // adjust path as needed
import appleHighlightedImage from "./applev2-highlighted.png"; // highlighted apple image

interface AppleProps {
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
  // Grid placement is still handled via inline style:
  const style: React.CSSProperties = {
    gridColumn: x + 1,
    gridRow: y + 1,
    position: "relative",
    // If cleared, make the element invisible
    visibility: cleared ? "hidden" : "visible",
  };

  // Always apply the “base apple” classes,
  // then if selected, add a golden outline,
  // if cleared, we already set `visibility: hidden`.
  const baseClasses =
    "flex items-center justify-center font-bold text-white relative w-[90%] ";

  // When selected, add a 3px gold outline. If not, omit.
  // const selectedClasses = selected
  // ? "outline outline-[3px] outline-gold"
  // : "";

  return (
    <div className={`${baseClasses} `} style={style}>
      <img
        src={selected ? appleHighlightedImage : appleImage}
        alt={`Apple ${value}`}
        className="object-contain pointer-events-none transform scale-[1.20]"
      />
      <div
        className="absolute top-[60%] left-1/2 -translate-x-[14.5px] -translate-y-[17px] pointer-events-none text-white w-[80%] h-[80%] flex items-center justify-center text-lg font-bold font-ubuntuSansMono"
      >
        {value}
      </div>
    </div>
  );
}