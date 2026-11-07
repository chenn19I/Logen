"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * 5x7 dot-matrix glyphs inspired by nearhackathon.com's pixel readout.
 * Each string has 7 rows of 5 characters ('1' = lit pixel, '0' = unlit grid dot).
 */
const MATRIX_FONT: Record<string, string[]> = {
  "0": [
    "01110",
    "10001",
    "10011",
    "10101",
    "11001",
    "10001",
    "01110",
  ],
  "1": [
    "00100",
    "01100",
    "00100",
    "00100",
    "00100",
    "00100",
    "01110",
  ],
  "2": [
    "01110",
    "10001",
    "00001",
    "00110",
    "01000",
    "10000",
    "11111",
  ],
  "3": [
    "11110",
    "00001",
    "00001",
    "01110",
    "00001",
    "00001",
    "11110",
  ],
  "4": [
    "00010",
    "00110",
    "01010",
    "10010",
    "11111",
    "00010",
    "00010",
  ],
  "5": [
    "11111",
    "10000",
    "11110",
    "00001",
    "00001",
    "10001",
    "01110",
  ],
  "6": [
    "00110",
    "01000",
    "10000",
    "11110",
    "10001",
    "10001",
    "01110",
  ],
  "7": [
    "11111",
    "00001",
    "00010",
    "00100",
    "01000",
    "01000",
    "01000",
  ],
  "8": [
    "01110",
    "10001",
    "10001",
    "01110",
    "10001",
    "10001",
    "01110",
  ],
  "9": [
    "01110",
    "10001",
    "10001",
    "01111",
    "00001",
    "00010",
    "01100",
  ],
  ".": [
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
    "01100",
    "01100",
  ],
  ":": [
    "00000",
    "01100",
    "01100",
    "00000",
    "01100",
    "01100",
    "00000",
  ],
  "-": [
    "00000",
    "00000",
    "00000",
    "11111",
    "00000",
    "00000",
    "00000",
  ],
  "/": [
    "00001",
    "00010",
    "00100",
    "00100",
    "01000",
    "10000",
    "00000",
  ],
  P: [
    "11110",
    "10001",
    "10001",
    "11110",
    "10000",
    "10000",
    "10000",
  ],
  N: [
    "10001",
    "11001",
    "10101",
    "10011",
    "10001",
    "10001",
    "10001",
  ],
  E: [
    "11111",
    "10000",
    "10000",
    "11110",
    "10000",
    "10000",
    "11111",
  ],
  A: [
    "01110",
    "10001",
    "10001",
    "11111",
    "10001",
    "10001",
    "10001",
  ],
  R: [
    "11110",
    "10001",
    "10001",
    "11110",
    "10100",
    "10010",
    "10001",
  ],
  S: [
    "01111",
    "10000",
    "10000",
    "01110",
    "00001",
    "00001",
    "11110",
  ],
  " ": [
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
  ],
};

export function PixelMatrixReadout({
  value,
  label,
  size = "md",
  tone = "paper",
  className,
}: {
  value: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  tone?: "paper" | "signal" | "positive" | "caution";
  className?: string;
}) {
  const chars = value.toUpperCase().split("");
  const cellSize = 4.5;
  const step = 6;
  const charWidth = 5 * step - 1.5; // 28.5
  const charGap = 6;
  const totalWidth =
    chars.length > 0
      ? chars.length * charWidth + (chars.length - 1) * charGap
      : charWidth;
  const totalHeight = 7 * step - 1.5; // 40.5

  const heightClass =
    size === "lg"
      ? "h-10 sm:h-12"
      : size === "sm"
        ? "h-5 sm:h-6"
        : "h-7 sm:h-8";

  const colorClass =
    tone === "positive"
      ? "text-positive"
      : tone === "signal"
        ? "text-signal"
        : tone === "caution"
          ? "text-caution"
          : "text-paper";

  return (
    <span
      role="img"
      aria-label={label ?? value}
      className={cn("inline-flex items-center select-none", colorClass, className)}
    >
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className={cn("w-auto overflow-visible", heightClass)}
        aria-hidden="true"
        focusable="false"
        shapeRendering="crispEdges"
      >
        {chars.map((ch, idx) => {
          const glyph = MATRIX_FONT[ch] ?? MATRIX_FONT["0"];
          const offsetX = idx * (charWidth + charGap);
          const bgDots: React.ReactNode[] = [];
          const litDots: React.ReactNode[] = [];

          for (let r = 0; r < 7; r += 1) {
            const rowStr = glyph[r] ?? "00000";
            for (let c = 0; c < 5; c += 1) {
              const x = c * step;
              const y = r * step;
              bgDots.push(
                <rect
                  key={`bg-${r}-${c}`}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  fill="currentColor"
                  opacity={0.11}
                />
              );
              if (rowStr[c] === "1") {
                litDots.push(
                  <rect
                    key={`lit-${r}-${c}`}
                    x={x}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                    fill="currentColor"
                  />
                );
              }
            }
          }

          return (
            <g key={`${ch}-${idx}`} transform={`translate(${offsetX} 0)`}>
              {bgDots}
              {litDots}
            </g>
          );
        })}
      </svg>
    </span>
  );
}
