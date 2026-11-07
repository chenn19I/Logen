"use client";

import React, { useEffect, useRef } from "react";

/**
 * Quiet, architectural terminal backdrop for the entire application.
 * Combines:
 * 1. Top atmospheric signal wash + masked micro-dot matrix
 * 2. Structural 1200px page-margin rails with `+` calibration intersections
 * 3. Subtle cursor-tracked grid illumination (disabled on reduced motion / touch)
 */
export function AmbientBackdrop() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqCoarse = window.matchMedia("(pointer: coarse)");
    if (mqReduced.matches || mqCoarse.matches) return;

    let rafId = 0;
    let targetX = window.innerWidth * 0.5;
    let targetY = window.innerHeight * 0.28;

    const onPointerMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          el.style.setProperty("--spot-x", `${targetX.toFixed(0)}px`);
          el.style.setProperty("--spot-y", `${targetY.toFixed(0)}px`);
        });
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="ambient-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* Top atmospheric signal wash */}
      <div className="ambient-backdrop-wash absolute inset-0" />

      {/* Masked micro-dot matrix + fine architectural grid */}
      <div className="ambient-backdrop-grid absolute inset-0" />

      {/* Subtle cursor-tracked illumination over the grid */}
      <div className="ambient-backdrop-spotlight absolute inset-0" />

      {/* Structural 1200px margin rails & calibration markers on wide screens */}
      <div className="mx-auto hidden h-full w-full max-w-page justify-between px-4 sm:px-6 lg:flex">
        <div className="relative h-full w-px bg-paper/[0.035]">
          <span className="absolute -left-[3.5px] top-20 font-mono text-[10px] leading-none text-paper/20">
            +
          </span>
          <span className="absolute -left-[3.5px] top-1/2 font-mono text-[10px] leading-none text-signal/30">
            +
          </span>
          <span className="absolute -left-[3.5px] bottom-24 font-mono text-[10px] leading-none text-paper/20">
            +
          </span>
          <span className="absolute -left-3 top-44 hidden origin-top-left -rotate-90 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.22em] text-paper/[0.14] xl:block">
            SYS.01 // KEYLESS.VAULT
          </span>
        </div>

        <div className="relative h-full w-px bg-paper/[0.035]">
          <span className="absolute -left-[3.5px] top-20 font-mono text-[10px] leading-none text-paper/20">
            +
          </span>
          <span className="absolute -left-[3.5px] top-1/2 font-mono text-[10px] leading-none text-positive/30">
            +
          </span>
          <span className="absolute -left-[3.5px] bottom-24 font-mono text-[10px] leading-none text-paper/20">
            +
          </span>
          <span className="absolute -right-3 bottom-44 hidden origin-bottom-right -rotate-90 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.22em] text-paper/[0.14] xl:block">
            NEP-171 // ZERO.KEYS
          </span>
        </div>
      </div>
    </div>
  );
}
