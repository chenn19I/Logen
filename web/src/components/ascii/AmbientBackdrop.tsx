"use client";

import React, { useEffect, useRef } from "react";
import { AsciiSpellCanvas } from "./AsciiSpellEngine";

/**
 * Calm terminal backdrop + interactive ASCII wizard spell canvas.
 * Dormant when idle; responds to scrolling, route transitions, and feature switches
 * with weightless ASCII rune animations.
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
    <>
      <div
        ref={rootRef}
        aria-hidden="true"
        className="ambient-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      >
        <div className="ambient-backdrop-wash absolute inset-0" />
        <div className="ambient-backdrop-grid absolute inset-0" />
        <div className="ambient-backdrop-spotlight absolute inset-0" />
      </div>
      <AsciiSpellCanvas />
    </>
  );
}
