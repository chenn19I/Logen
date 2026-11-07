"use client";

import React, { useEffect, useRef } from "react";

/**
 * Quiet terminal backdrop for the application.
 * Provides a soft top wash, subtle masked dot-grid, and gentle cursor spotlight.
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
      <div className="ambient-backdrop-wash absolute inset-0" />
      <div className="ambient-backdrop-grid absolute inset-0" />
      <div className="ambient-backdrop-spotlight absolute inset-0" />
      <div className="mx-auto hidden h-full w-full max-w-page justify-between px-4 sm:px-6 lg:flex">
        <div className="h-full w-px bg-paper/[0.03]" />
        <div className="h-full w-px bg-paper/[0.03]" />
      </div>
    </div>
  );
}
