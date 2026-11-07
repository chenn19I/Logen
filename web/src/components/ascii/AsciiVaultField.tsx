"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type FieldMode = "sphere" | "cube" | "torus";

interface Point3D {
  x: number;
  y: number;
  z: number;
  charIndex: number;
  letter: string;
  i: number;
}

const PHRASES = ["KEYLESSVAULT", "SEAT==WALLET", "ZEROKEYS0007"] as const;
const GLYPHS = "LOGEN0123456789·+✦▣◈:/=-";

function buildPoints(count: number, mode: FieldMode): Point3D[] {
  const phrase =
    mode === "sphere"
      ? PHRASES[0]
      : mode === "cube"
        ? PHRASES[1]
        : PHRASES[2];

  if (mode === "cube") {
    const side = Math.max(6, Math.round(Math.cbrt(count)));
    const pts: Point3D[] = [];
    let idx = 0;
    for (let ix = 0; ix < side; ix += 1) {
      for (let iy = 0; iy < side; iy += 1) {
        for (let iz = 0; iz < side; iz += 1) {
          // Focus points on the outer shell and core diagonals of the vault cube
          const isSurface =
            ix === 0 ||
            ix === side - 1 ||
            iy === 0 ||
            iy === side - 1 ||
            iz === 0 ||
            iz === side - 1;
          const isCore =
            Math.abs(ix - (side - 1) / 2) <= 1.2 &&
            Math.abs(iy - (side - 1) / 2) <= 1.2 &&
            Math.abs(iz - (side - 1) / 2) <= 1.2;
          if (!isSurface && !isCore && (ix + iy + iz) % 2 !== 0) continue;

          const nx = (ix / (side - 1)) * 2 - 1;
          const ny = (iy / (side - 1)) * 2 - 1;
          const nz = (iz / (side - 1)) * 2 - 1;
          const scale = 0.72;
          const letter =
            idx % 3 === 0
              ? phrase[idx % phrase.length]
              : GLYPHS[idx % GLYPHS.length];
          pts.push({
            x: nx * scale,
            y: ny * scale,
            z: nz * scale,
            charIndex: idx % phrase.length,
            letter,
            i: idx,
          });
          idx += 1;
        }
      }
    }
    return pts;
  }

  if (mode === "torus") {
    const pts: Point3D[] = [];
    const majorRings = 36;
    const minorSteps = Math.max(12, Math.floor(count / majorRings));
    const R = 0.68;
    const r = 0.3;
    let idx = 0;
    for (let u = 0; u < majorRings; u += 1) {
      const theta = (u / majorRings) * Math.PI * 2;
      for (let v = 0; v < minorSteps; v += 1) {
        const phi = (v / minorSteps) * Math.PI * 2 + u * 0.12;
        const x = (R + r * Math.cos(phi)) * Math.cos(theta);
        const z = (R + r * Math.cos(phi)) * Math.sin(theta);
        const y = r * Math.sin(phi) * 1.15;
        const letter =
          idx % 2 === 0
            ? phrase[idx % phrase.length]
            : GLYPHS[idx % GLYPHS.length];
        pts.push({
          x,
          y,
          z,
          charIndex: idx % phrase.length,
          letter,
          i: idx,
        });
        idx += 1;
      }
    }
    return pts;
  }

  // Default: Fibonacci sphere (inspired by nearhackathon.com)
  return Array.from({ length: count }, (_, idx) => {
    const y = 1 - (idx / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = 2.399963229728653 * idx;
    const letter =
      idx % 2 === 0
        ? phrase[idx % phrase.length]
        : GLYPHS[idx % GLYPHS.length];
    return {
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
      charIndex: idx % phrase.length,
      letter,
      i: idx,
    };
  });
}

function getLayout(width: number, height: number) {
  const field = Math.min(width - 24, 680);
  const radius = Math.min(field * 0.33, height * 0.33);
  return {
    cx: width / 2,
    cy: height * 0.43,
    field,
    radius,
    font: Math.max(8, Math.min(11.5, radius / 15)),
  };
}

export function AsciiVaultField({
  className,
  compact = false,
  initialMode = "sphere",
}: {
  className?: string;
  compact?: boolean;
  initialMode?: FieldMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeRef = useRef(0);
  const [mode, setMode] = useState<FieldMode>(initialMode);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  const pointerRef = useRef({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    pointerX: 0,
    pointerY: 0,
    active: false,
    glow: 0,
    pulse: 0,
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let rafId = 0;
    let lastTime = 0;
    let inView = true;
    let disposed = false;

    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    const pointCount = isMobile ? 540 : 880;
    const frameInterval = 1000 / (isMobile ? 36 : 60);

    const points = buildPoints(pointCount, mode);
    const targetPhrase =
      mode === "sphere"
        ? PHRASES[0]
        : mode === "cube"
          ? PHRASES[1]
          : PHRASES[2];
    const phraseLen = targetPhrase.length;

    // Pick deterministic indices for the target-lock readout
    const captureIndices = Array.from(
      { length: phraseLen },
      (_, k) => Math.floor(points.length * 0.35) + k * 7
    ).map((idx) => idx % points.length);

    const projected = points.map((p) => ({
      x: 0,
      y: 0,
      z: 0,
      letter: p.letter,
      i: p.i,
    }));
    const sorted = [...projected];

    // Offscreen glyph cache for crisp 60fps rendering
    const spriteCanvas = document.createElement("canvas");
    const spriteCtx = spriteCanvas.getContext("2d");
    const uniqueChars = Array.from(new Set([...targetPhrase, ...GLYPHS]));
    const charToCol = new Map<string, number>();
    uniqueChars.forEach((ch, idx) => charToCol.set(ch, idx));

    let dpr = 1;
    let baseFont = 9;
    const cellPx = 24;

    const PAPER = "#ece8d8";
    const MUTED = "#8d9585";
    const SIGNAL = "#3b9bff";
    const POSITIVE = "#7bd88f";

    function rebuildSprites() {
      if (!spriteCtx) return;
      spriteCanvas.width = uniqueChars.length * cellPx * dpr;
      spriteCanvas.height = 12 * cellPx * dpr;
      spriteCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spriteCtx.textAlign = "center";
      spriteCtx.textBaseline = "middle";

      // Rows 0..3: paper depth levels, Rows 4..7: signal blue glow, Rows 8..11: positive green pulse
      for (let palette = 0; palette < 3; palette += 1) {
        for (let depth = 0; depth < 4; depth += 1) {
          const row = palette * 4 + depth;
          spriteCtx.fillStyle =
            palette === 1 ? SIGNAL : palette === 2 ? POSITIVE : PAPER;
          spriteCtx.font = `500 ${(baseFont + depth * 0.45).toFixed(1)}px "Geist Mono", "IBM Plex Mono", monospace`;
          for (let col = 0; col < uniqueChars.length; col += 1) {
            spriteCtx.fillText(
              uniqueChars[col],
              col * cellPx + cellPx / 2,
              row * cellPx + cellPx / 2
            );
          }
        }
      }
    }

    function drawFrame(t: number) {
      if (!ctx || !width || !height) return;
      ctx.clearRect(0, 0, width, height);

      const { cx, cy, field, radius } = getLayout(width, height);
      const leftEdge = Math.max(14, cx - field / 2);
      const rightEdge = Math.min(width - 14, cx + field / 2);
      const bottomEdge = height - 16;

      const ptr = pointerRef.current;
      const yaw = t * 0.16 + ptr.x * 0.65;
      const pitch = 0.22 + ptr.y * 0.42 + Math.sin(t * 0.35) * 0.06;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      for (let i = 0; i < points.length; i += 1) {
        const src = points[i];
        const dst = projected[i];
        const rx = src.x * cosY + src.z * sinY;
        const rz = src.z * cosY - src.x * sinY;
        const ry = src.y * cosP - rz * sinP;
        const depthZ = src.y * sinP + rz * cosP;
        const perspective = 2.85 / (2.85 - 0.42 * depthZ);
        dst.x = cx + rx * radius * perspective;
        dst.y = cy + ry * radius * perspective;
        dst.z = depthZ;
      }

      sorted.sort((a, b) => a.z - b.z);

      // Draw subtle equatorial & meridian ASCII ring hairlines
      ctx.save();
      ctx.strokeStyle = "rgba(236, 232, 216, 0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.04, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Render 3D ASCII characters from offscreen sprite sheet
      for (let i = 0; i < sorted.length; i += 1) {
        const pt = sorted[i];
        const dist =
          ptr.glow > 0.01 && pt.z > -0.2
            ? Math.hypot(pt.x - ptr.pointerX, pt.y - ptr.pointerY)
            : 999;
        const proximity =
          dist < 76 ? Math.max(0, 1 - dist / 76) * ptr.glow * (pt.z + 1.1) * 0.65 : 0;
        const pulseWave =
          ptr.pulse > 0.01
            ? Math.max(
                0,
                1 - Math.abs(Math.hypot(pt.x - cx, pt.y - cy) - (1 - ptr.pulse) * radius * 1.35) / 28
              ) * ptr.pulse
            : 0;

        const alpha = Math.min(
          1,
          0.08 + (pt.z + 1) * 0.28 + proximity * 0.55 + pulseWave * 0.5
        );
        ctx.globalAlpha = alpha;

        const depthLevel = Math.min(3, Math.max(0, Math.round((pt.z + 1) * 1.5)));
        const palette =
          pulseWave > 0.18 ? 2 : proximity > 0.15 ? 1 : 0;
        const row = palette * 4 + depthLevel;
        const col = charToCol.get(pt.letter) ?? 0;

        ctx.drawImage(
          spriteCanvas,
          col * cellPx * dpr,
          row * cellPx * dpr,
          cellPx * dpr,
          cellPx * dpr,
          pt.x - cellPx / 2,
          pt.y - cellPx / 2,
          cellPx,
          cellPx
        );
      }

      ctx.globalAlpha = 1;

      // Target-lock leader lines & character extraction readout (like nearhackathon.com)
      const cycle = t % 16;
      const charIdx = Math.min(phraseLen - 1, Math.floor(cycle / 1.05));
      const charPhase = (cycle % 1.05) / 1.05;
      const settled = cycle >= phraseLen * 1.05;

      const spacing = Math.min(24, (field - 44) / phraseLen);
      const startX = cx - ((phraseLen - 1) * spacing) / 2;
      const readoutY = height - (compact ? 46 : 54);

      const primaryTarget = projected[captureIndices[charIdx]];
      const secondaryTarget =
        projected[captureIndices[(charIdx + 5) % phraseLen]];

      if (!settled && primaryTarget && secondaryTarget) {
        const anchors: Array<[typeof primaryTarget, number]> = [
          [primaryTarget, leftEdge + 16],
          [secondaryTarget, rightEdge - 16],
        ];
        anchors.forEach(([target, anchorX], idx) => {
          ctx.strokeStyle = idx === 0 ? SIGNAL : PAPER;
          ctx.globalAlpha = idx === 0 ? 0.52 : 0.22;
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.moveTo(anchorX, 34);
          ctx.lineTo(target.x, target.y - 8);
          ctx.stroke();

          // Small target reticle box around locked 3D node
          if (idx === 0) {
            ctx.strokeRect(target.x - 8, target.y - 8, 16, 16);
          }
        });
      }

      // Draw captured phrase slots at the bottom
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${compact ? 15 : 18}px "Geist Mono", "IBM Plex Mono", monospace`;

      for (let i = 0; i < phraseLen; i += 1) {
        const isLit =
          settled || i < charIdx || (i === charIdx && charPhase > 0.82);
        const ch = targetPhrase[i];
        ctx.fillStyle = isLit
          ? ch === "=" || ch === "0" || ch === "7"
            ? POSITIVE
            : SIGNAL
          : PAPER;
        ctx.globalAlpha = isLit ? 0.96 : 0.2;
        ctx.fillText(isLit ? ch : "·", startX + i * spacing, readoutY);
      }

      // Smooth cubic Hermite flight of captured letter from 3D node to readout slot
      if (!settled && primaryTarget && charPhase > 0.4 && charPhase < 0.84) {
        const u = (charPhase - 0.4) / 0.44;
        const ease = u * u * (3 - 2 * u);
        ctx.globalAlpha = 1;
        ctx.fillStyle = SIGNAL;
        ctx.font = `600 ${(12 + 6 * ease).toFixed(1)}px "Geist Mono", "IBM Plex Mono", monospace`;
        const fx = primaryTarget.x + (startX + charIdx * spacing - primaryTarget.x) * ease;
        const fy = primaryTarget.y + (readoutY - primaryTarget.y) * ease;
        ctx.fillText(targetPhrase[charIdx], fx, fy);
      }

      // Draw four corner brackets around the field
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 1;
      const corners: Array<[number, number, number, number]> = [
        [leftEdge, 16, 1, 1],
        [rightEdge, 16, -1, 1],
        [leftEdge, bottomEdge, 1, -1],
        [rightEdge, bottomEdge, -1, -1],
      ];
      for (const [bx, by, dx, dy] of corners) {
        ctx.beginPath();
        ctx.moveTo(bx + 18 * dx, by);
        ctx.lineTo(bx + 4 * dx, by);
        ctx.quadraticCurveTo(bx, by, bx, by + 4 * dy);
        ctx.lineTo(bx, by + 18 * dy);
        ctx.stroke();
      }

      // Bottom telemetry captions inside the brackets
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = MUTED;
      ctx.font = '10px "Geist Mono", "IBM Plex Mono", monospace';
      ctx.textAlign = "left";
      ctx.fillText(
        paused || reduced
          ? "LOGEN / ASCII VAULT FIELD"
          : "MOVE / CLICK TO PULSE FIELD",
        leftEdge + 12,
        bottomEdge - 12
      );
      ctx.textAlign = "right";
      ctx.fillText(
        `${String(settled ? phraseLen : charIdx + 1).padStart(2, "0")} / ${String(
          phraseLen
        ).padStart(2, "0")}`,
        rightEdge - 12,
        bottomEdge - 12
      );
      ctx.globalAlpha = 1;
    }

    function resize() {
      if (!canvas || !ctx || disposed) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
      width = rect.width;
      height = rect.height;
      if (width <= 0 || height <= 0) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseFont = getLayout(width, height).font;
      rebuildSprites();
      drawFrame(reduced ? 14 : timeRef.current);
    }

    function shouldAnimate() {
      return !disposed && !paused && !reduced && inView && !document.hidden;
    }

    function schedule() {
      if (!shouldAnimate()) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        lastTime = 0;
        return;
      }
      if (!rafId) {
        rafId = requestAnimationFrame(loop);
      }
    }

    function loop(now: number) {
      rafId = 0;
      if (!shouldAnimate()) return;
      if (!lastTime) lastTime = now - frameInterval;
      const elapsed = now - lastTime;
      if (elapsed >= frameInterval - 0.5) {
        const dt = Math.min(elapsed / 1000, 0.05);
        lastTime = now;
        timeRef.current += 1.25 * dt;

        const ptr = pointerRef.current;
        const smooth = 1 - Math.exp(-5 * dt);
        ptr.x += (ptr.targetX - ptr.x) * smooth;
        ptr.y += (ptr.targetY - ptr.y) * smooth;
        ptr.glow += ((ptr.active ? 1 : 0) - ptr.glow) * smooth;
        if (ptr.pulse > 0.005) {
          ptr.pulse = Math.max(0, ptr.pulse - dt * 1.35);
        } else {
          ptr.pulse = 0;
        }

        drawFrame(timeRef.current);
      }
      schedule();
    }

    function onPointerMove(e: PointerEvent) {
      if (!canvas || paused || reduced) return;
      const rect = canvas.getBoundingClientRect();
      const ptr = pointerRef.current;
      ptr.pointerX = e.clientX - rect.left;
      ptr.pointerY = e.clientY - rect.top;
      ptr.targetX = Math.max(
        -1,
        Math.min(1, (ptr.pointerX - width / 2) / (0.42 * width))
      );
      ptr.targetY = Math.max(
        -1,
        Math.min(1, (ptr.pointerY - 0.43 * height) / (0.42 * height))
      );
      ptr.active = true;
    }

    function onPointerDown(e: PointerEvent) {
      onPointerMove(e);
      pointerRef.current.pulse = 1;
    }

    function onPointerLeave() {
      const ptr = pointerRef.current;
      ptr.active = false;
      ptr.targetX = 0;
      ptr.targetY = 0;
    }

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointercancel", onPointerLeave);

    const ro = new ResizeObserver(resize);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
      schedule();
    });

    ro.observe(canvas);
    io.observe(canvas);
    resize();
    schedule();

    document.addEventListener("visibilitychange", schedule);
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!disposed) resize();
      });
    }

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", schedule);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointercancel", onPointerLeave);
    };
  }, [mode, paused, reduced, compact]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded border border-line bg-ink-deep",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-label text-paper-dim">
            [ ASCII VAULT FIELD · NEAR KEYLESS ]
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {(["sphere", "cube", "torus"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              aria-pressed={mode === item}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-label transition-colors",
                mode === item
                  ? "border-signal bg-signal-soft text-paper"
                  : "border-line bg-surface-sunken text-paper-muted hover:border-line-strong hover:text-paper"
              )}
            >
              {item}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            disabled={reduced}
            aria-label={
              reduced
                ? "Motion disabled by system preference"
                : paused
                  ? "Resume ASCII animation"
                  : "Pause ASCII animation"
            }
            className="ml-1 inline-flex items-center gap-1 rounded border border-line bg-surface-sunken px-2 py-0.5 font-mono text-[9px] uppercase tracking-label text-paper-muted transition-colors hover:border-line-strong hover:text-paper disabled:opacity-50"
          >
            {paused ? (
              <Play className="h-2.5 w-2.5" aria-hidden="true" />
            ) : (
              <Pause className="h-2.5 w-2.5" aria-hidden="true" />
            )}
            {reduced ? "STATIC" : paused ? "RESUME" : "PAUSE"}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "relative w-full select-none",
          compact ? "h-[270px]" : "h-[340px] sm:h-[380px]"
        )}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-crosshair touch-pan-y"
          role="img"
          aria-label="Interactive 3D ASCII character field representing Logen keyless seat vaults on NEAR. Move pointer or click to interact."
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3.5 py-2 font-mono text-[9px] uppercase tracking-label text-paper-muted">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-signal" aria-hidden="true" />
          {mode === "sphere"
            ? "Topology: Fibonacci Vault Sphere · 0 Access Keys"
            : mode === "cube"
              ? "Topology: Sub-Account Vault Cube · s007.logen.testnet"
              : "Topology: Atomic Handoff Torus · rotation_seq"}
        </span>
        <span className="text-positive">NEP-171 + NEP-413 VERIFIED</span>
      </div>
    </div>
  );
}
