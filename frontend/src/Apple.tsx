import React from "react";
import appleImage from "../apple.png"; // adjust path as needed
import "./App.css";

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
  const style: React.CSSProperties = {
    gridColumn: x + 1,
    gridRow: y + 1,
    visibility: cleared ? "hidden" : "visible",
    position: "relative",
  };

  const className = `apple${selected ? " selected" : ""}${
    cleared ? " cleared" : ""
  }`;

  return (
    <div className={className} style={style}>
      <img
        src={appleImage}
        alt={`Apple ${value}`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none",
        }}
      />
      <div className="apple-value">{value}</div>
    </div>
  );
}
