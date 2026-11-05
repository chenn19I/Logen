import React from "react";
import { cn } from "@/lib/utils";

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffledInner(tokenId: string): Array<{ x: number; y: number; key: string }> {
  const inner: Array<{ x: number; y: number; key: string }> = [];
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      inner.push({ x, y, key: `${x}-${y}` });
    }
  }
  let seed = hashString(tokenId);
  for (let i = inner.length - 1; i > 0; i -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [inner[i], inner[j]] = [inner[j], inner[i]];
  }
  return inner;
}

export function SeatGlyph({
  tokenId,
  innerDots = 0,
  size = 96,
  className,
  label,
  ping = false,
}: {
  tokenId: string;
  innerDots?: number;
  size?: number;
  className?: string;
  label?: string;
  ping?: boolean;
}) {
  const litCount = Math.max(0, Math.min(9, innerDots));
  const order = shuffledInner(tokenId);
  const lit = new Set(order.slice(0, litCount).map((dot) => dot.key));
  const newest = litCount > 0 ? order[litCount - 1]?.key : null;
  const accessibilityLabel =
    label ?? `Seat glyph. ${litCount} of 9 inner earning dots lit.`;

  const cells: React.ReactNode[] = [];
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      const outer = x === 0 || x === 4 || y === 0 || y === 4;
      const key = `${x}-${y}`;
      const isLit = outer || lit.has(key);
      const isNewest = ping && !outer && key === newest;
      cells.push(
        <rect
          key={key}
          x={x * 8 + 1.5}
          y={y * 8 + 1.5}
          width={5}
          height={5}
          rx={0.7}
          fill={isLit ? (outer ? "var(--text)" : "var(--accent)") : "var(--line-strong)"}
          opacity={isLit ? (outer ? 0.92 : 1) : 0.55}
          className={isNewest ? "animate-dot-ping" : undefined}
          style={
            isNewest
              ? { transformOrigin: `${x * 8 + 4}px ${y * 8 + 4}px` }
              : undefined
          }
        />
      );
    }
  }

  return (
    <span
      role="img"
      aria-label={accessibilityLabel}
      className={cn("inline-block shrink-0 align-middle", className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        {cells}
      </svg>
    </span>
  );
}
