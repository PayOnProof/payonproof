"use client";

import { useMemo } from "react";

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getColor(hash: number, index: number): string {
  const hue = ((hash * (index + 1) * 137) % 360);
  return `hsl(${hue}, 65%, 55%)`;
}

interface IdenticonProps {
  address: string;
  size?: number;
  className?: string;
}

export function Identicon({ address, size = 32, className }: IdenticonProps) {
  const cells = useMemo(() => {
    const hash = hashCode(address);
    const grid: boolean[][] = [];
    for (let row = 0; row < 5; row++) {
      grid[row] = [];
      for (let col = 0; col < 3; col++) {
        grid[row][col] = ((hash >> (row * 3 + col)) & 1) === 1;
      }
      // Mirror
      grid[row][3] = grid[row][1];
      grid[row][4] = grid[row][0];
    }
    return { grid, color1: getColor(hash, 0), color2: getColor(hash, 3) };
  }, [address]);

  const cellSize = size / 5;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      <rect width={size} height={size} rx={size * 0.2} fill={cells.color2} opacity={0.2} />
      {cells.grid.map((row, ri) =>
        row.map((cell, ci) =>
          cell ? (
            <rect
              key={`${ri}-${ci}`}
              x={ci * cellSize}
              y={ri * cellSize}
              width={cellSize}
              height={cellSize}
              fill={cells.color1}
              rx={1}
            />
          ) : null
        )
      )}
    </svg>
  );
}
