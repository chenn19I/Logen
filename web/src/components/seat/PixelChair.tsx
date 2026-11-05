import React from "react";
import { cn } from "@/lib/utils";

/**
 * The club chair, drawn on a 24x24 pixel grid.
 * Cream frame, one blue cushion, three green buttons.
 */
export function PixelChair({
  size = 280,
  className,
  label = "Pixel armchair with a blue cushion and three green buttons.",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={cn("block", className)}
      shapeRendering="crispEdges"
    >
      {/* Backrest frame */}
      <rect x="5" y="3" width="14" height="2" fill="var(--text)" />
      <rect x="5" y="5" width="2" height="8" fill="var(--text)" />
      <rect x="17" y="5" width="2" height="8" fill="var(--text)" />

      {/* Backrest well */}
      <rect x="7" y="5" width="10" height="8" fill="var(--surface-sunken)" />

      {/* Blue cushion with a paper core */}
      <rect x="7" y="5" width="10" height="7" fill="var(--accent)" />
      <rect x="10" y="7" width="4" height="3" fill="var(--text)" />

      {/* Armrests */}
      <rect x="3" y="10" width="3" height="8" fill="var(--text)" />
      <rect x="18" y="10" width="3" height="8" fill="var(--text)" />
      <rect x="6" y="11" width="1" height="5" fill="var(--surface-sunken)" />
      <rect x="17" y="11" width="1" height="5" fill="var(--surface-sunken)" />

      {/* Seat cushion and front rail */}
      <rect x="6" y="12" width="12" height="4" fill="var(--surface-sunken)" />
      <rect x="7" y="12" width="10" height="3" fill="var(--accent)" />
      <rect x="4" y="16" width="16" height="2" fill="var(--text)" />

      {/* Three buttons */}
      <rect x="8" y="13" width="2" height="1.5" fill="var(--positive)" />
      <rect x="11" y="13" width="2" height="1.5" fill="var(--positive)" />
      <rect x="14" y="13" width="2" height="1.5" fill="var(--positive)" />

      {/* Legs */}
      <rect x="6" y="18" width="2" height="4" fill="var(--text)" />
      <rect x="16" y="18" width="2" height="4" fill="var(--text)" />
      <rect x="5" y="22" width="4" height="1" fill="var(--text)" />
      <rect x="15" y="22" width="4" height="1" fill="var(--text)" />
    </svg>
  );
}
