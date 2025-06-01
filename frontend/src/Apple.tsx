import React from "react";
import appleImage from "./apple.png"; // adjust path as needed
import appleHighlightedImage from "./apple-highlighted.png"; // highlighted apple image
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

  const className = `apple${
    cleared ? " cleared" : ""
  }`;

  // Choose the appropriate image based on selection
  const imageSrc = selected ? appleHighlightedImage : appleImage;

  return (
    <div className={className} style={style}>
      <img
        src={imageSrc}
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