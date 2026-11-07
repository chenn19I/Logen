"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, ZoomIn } from "lucide-react";
import { playScanPulse, playTactileClick } from "@/lib/sound";
import { cn } from "@/lib/utils";

export type FieldMode = "seat" | "cube" | "prism";

interface Point3D {
  x: number;
  y: number;
  z: number;
  charIndex: number;
  letter: string;
  i: number;
  accent?: boolean;
}

const PHRASES = ["SEAT==WALLET", "KEYLESSVAULT", "ZEROKEYS0007"] as const;
const GLYPHS = "LOGEN0123456789·+✦▣◈:/=-";
const ACCENT_GLYPHS = "✦◈▣+07=$";

function buildPoints(count: number, mode: FieldMode): Point3D[] {
  const phrase =
    mode === "seat"
      ? PHRASES[0]
      : mode === "cube"
        ? PHRASES[1]
        : PHRASES[2];

  const pts: Point3D[] = [];
  let idx = 0;

  const pushPoint = (x: number, y: number, z: number, accent = false) => {
    const letter = accent
      ? idx % 2 === 0
        ? phrase[idx % phrase.length]
        : ACCENT_GLYPHS[idx % ACCENT_GLYPHS.length]
      : idx % 3 === 0
        ? phrase[idx % phrase.length]
        : GLYPHS[idx % GLYPHS.length];
    pts.push({
      x,
      y,
      z,
      charIndex: idx % phrase.length,
      letter,
      i: idx,
      accent,
    });
    idx += 1;
  };

  if (mode === "seat") {
    // 1. High-back Club Throne backrest (with wingback side bolsters)
    const bxSteps = 13;
    const bySteps = 14;
    for (let ix = 0; ix < bxSteps; ix += 1) {
      const nx = (ix / (bxSteps - 1)) * 2 - 1; // -1..1
      const x = nx * 0.52;
      for (let iy = 0; iy < bySteps; iy += 1) {
        const uy = iy / (bySteps - 1); // 0 (top) .. 1 (seat join)
        const y = -0.82 + uy * 0.92; // -0.82 .. +0.10
        const isEdge =
          ix === 0 || ix === bxSteps - 1 || iy === 0 || iy === bySteps - 1;
        // Front & back face of backrest
        for (const z of [-0.46, -0.32]) {
          if (isEdge || (ix + iy) % 2 === 0) {
            pushPoint(x, y, z, false);
          }
        }
        // Wingback upper bolsters projecting slightly forward
        if ((ix === 0 || ix === bxSteps - 1) && uy < 0.55) {
          pushPoint(x, y, -0.20, false);
        }
      }
    }

    // 2. Plush Seat Cushion (horizontal slab)
    const sxSteps = 13;
    const szSteps = 12;
    for (let ix = 0; ix < sxSteps; ix += 1) {
      const x = ((ix / (sxSteps - 1)) * 2 - 1) * 0.5;
      for (let iz = 0; iz < szSteps; iz += 1) {
        const z = -0.34 + (iz / (szSteps - 1)) * 0.84; // -0.34 .. +0.50
        const isEdge =
          ix === 0 || ix === sxSteps - 1 || iz === 0 || iz === szSteps - 1;
        for (const y of [0.1, 0.26]) {
          if (isEdge || (ix + iz) % 2 === 0) {
            pushPoint(x, y, z, false);
          }
        }
      }
    }

    // 3. Left & Right Club Armrests
    const armYSteps = 6;
    const armZSteps = 11;
    for (const side of [-1, 1]) {
      for (const xOffset of [0.48, 0.62]) {
        const x = side * xOffset;
        for (let iy = 0; iy < armYSteps; iy += 1) {
          const y = -0.22 + (iy / (armYSteps - 1)) * 0.46; // -0.22 .. +0.24
          for (let iz = 0; iz < armZSteps; iz += 1) {
            const z = -0.36 + (iz / (armZSteps - 1)) * 0.86;
            const isArmBorder =
              iy === 0 ||
              iy === armYSteps - 1 ||
              iz === 0 ||
              iz === armZSteps - 1;
            if (isArmBorder && (iy + iz) % 2 === 0) {
              pushPoint(x, y, z, false);
            }
          }
        }
      }
    }

    // 4. Four structural legs + isometric base stretcher rails
    const legCorners: Array<[number, number]> = [
      [-0.48, -0.34],
      [0.48, -0.34],
      [-0.48, 0.46],
      [0.48, 0.46],
    ];
    for (const [lx, lz] of legCorners) {
      for (let s = 0; s < 9; s += 1) {
        const y = 0.28 + (s / 8) * 0.54; // 0.28 .. 0.82
        pushPoint(lx, y, lz, false);
        pushPoint(lx * 0.92, y, lz * 0.92, false);
      }
    }
    // Base perimeter rails connecting the legs
    for (let s = 0; s < 15; s += 1) {
      const t = (s / 14) * 2 - 1;
      pushPoint(t * 0.48, 0.76, 0.46, false);
      pushPoint(t * 0.48, 0.76, -0.34, false);
      pushPoint(-0.48, 0.76, -0.34 + ((t + 1) / 2) * 0.8, false);
      pushPoint(0.48, 0.76, -0.34 + ((t + 1) / 2) * 0.8, false);
    }

    // 5. Floating Keyless Vault Cube suspended above the seat cushion (Signal Accent)
    const vSteps = 5;
    for (let ix = 0; ix < vSteps; ix += 1) {
      for (let iy = 0; iy < vSteps; iy += 1) {
        for (let iz = 0; iz < vSteps; iz += 1) {
          const isShell =
            ix === 0 ||
            ix === vSteps - 1 ||
            iy === 0 ||
            iy === vSteps - 1 ||
            iz === 0 ||
            iz === vSteps - 1;
          if (!isShell) continue;
          const vx = ((ix / (vSteps - 1)) * 2 - 1) * 0.2;
          const vy = -0.32 + ((iy / (vSteps - 1)) * 2 - 1) * 0.18;
          const vz = 0.08 + ((iz / (vSteps - 1)) * 2 - 1) * 0.2;
          pushPoint(vx, vy, vz, true);
        }
      }
    }

    return pts;
  }

  if (mode === "cube") {
    // 4D Tesseract Vault: Outer NFT Shell + Inner Keyless Vault Core + 8 Hypercube Struts
    const outerSide = Math.max(7, Math.round(Math.cbrt(count * 0.65)));
    const outerScale = 0.76;
    const innerScale = 0.36;

    // Outer Cube Shell (edges & lattice faces)
    for (let ix = 0; ix < outerSide; ix += 1) {
      for (let iy = 0; iy < outerSide; iy += 1) {
        for (let iz = 0; iz < outerSide; iz += 1) {
          const onX = ix === 0 || ix === outerSide - 1;
          const onY = iy === 0 || iy === outerSide - 1;
          const onZ = iz === 0 || iz === outerSide - 1;
          const boundaryCount = (onX ? 1 : 0) + (onY ? 1 : 0) + (onZ ? 1 : 0);
          if (boundaryCount === 0) continue;
          // Keep all 12 wireframe edges and a clean lattice on faces
          if (boundaryCount === 1 && (ix + iy + iz) % 2 !== 0) continue;

          const nx = (ix / (outerSide - 1)) * 2 - 1;
          const ny = (iy / (outerSide - 1)) * 2 - 1;
          const nz = (iz / (outerSide - 1)) * 2 - 1;
          pushPoint(nx * outerScale, ny * outerScale, nz * outerScale, false);
        }
      }
    }

    // Inner Keyless Vault Core (Signal Accent)
    const innerSide = 5;
    for (let ix = 0; ix < innerSide; ix += 1) {
      for (let iy = 0; iy < innerSide; iy += 1) {
        for (let iz = 0; iz < innerSide; iz += 1) {
          const isSurface =
            ix === 0 ||
            ix === innerSide - 1 ||
            iy === 0 ||
            iy === innerSide - 1 ||
            iz === 0 ||
            iz === innerSide - 1;
          if (!isSurface) continue;
          const nx = (ix / (innerSide - 1)) * 2 - 1;
          const ny = (iy / (innerSide - 1)) * 2 - 1;
          const nz = (iz / (innerSide - 1)) * 2 - 1;
          pushPoint(nx * innerScale, ny * innerScale, nz * innerScale, true);
        }
      }
    }

    // 8 Diagonal 4D Tesseract Struts connecting inner & outer vertices
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          for (let step = 1; step <= 7; step += 1) {
            const u = step / 8;
            const s = innerScale + (outerScale - innerScale) * u;
            pushPoint(sx * s, sy * s, sz * s, true);
          }
        }
      }
    }

    return pts;
  }

  // "prism": Octahedral Bipyramid Crystal Obelisk + Square Ledger Orbit
  const layers = 23;
  for (let ly = 0; ly < layers; ly += 1) {
    const ny = (ly / (layers - 1)) * 2 - 1; // -1 (top apex) .. +1 (bottom apex)
    const y = ny * 0.86;
    const span = (1 - Math.abs(ny)) * 0.72;
    const perSide = Math.max(2, Math.round(span * 16));

    // 4 diamond edges at height y: (span, 0) -> (0, span) -> (-span, 0) -> (0, -span)
    const corners: Array<[number, number]> = [
      [span, 0],
      [0, span],
      [-span, 0],
      [0, -span],
    ];
    for (let c = 0; c < 4; c += 1) {
      const [x0, z0] = corners[c];
      const [x1, z1] = corners[(c + 1) % 4];
      for (let s = 0; s < perSide; s += 1) {
        const u = s / perSide;
        const x = x0 + (x1 - x0) * u;
        const z = z0 + (z1 - z0) * u;
        const isRidge = s === 0 || Math.abs(ny) < 0.06;
        pushPoint(x, y, z, isRidge);
      }
    }
    // Central vertical zero-key spine
    pushPoint(0, y, 0, true);
  }

  // Tilted square orbital ledger frame around the crystal
  const orbitSteps = 22;
  const orbitScale = 0.82;
  const orbitCorners: Array<[number, number]> = [
    [-orbitScale, -orbitScale],
    [orbitScale, -orbitScale],
    [orbitScale, orbitScale],
    [-orbitScale, orbitScale],
  ];
  for (let c = 0; c < 4; c += 1) {
    const [x0, z0] = orbitCorners[c];
    const [x1, z1] = orbitCorners[(c + 1) % 4];
    for (let s = 0; s < orbitSteps; s += 1) {
      const u = s / orbitSteps;
      const x = x0 + (x1 - x0) * u;
      const z = z0 + (z1 - z0) * u;
      const y = (x - z) * 0.22;
      pushPoint(x, y, z, s % 4 === 0);
    }
  }

  return pts;
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

const ZOOM_LEVELS = [1.0, 1.18, 1.32] as const;

export function AsciiVaultField({
  className,
  compact = false,
  initialMode = "seat",
  activeMode,
  onModeChange,
}: {
  className?: string;
  compact?: boolean;
  initialMode?: FieldMode;
  activeMode?: FieldMode;
  onModeChange?: (mode: FieldMode) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeRef = useRef(0);
  const restippleRef = useRef(0); // 1.0 -> 0.0 cellular stipple transition (TONASY99 Restipple)
  const [internalMode, setInternalMode] = useState<FieldMode>(initialMode);
  const mode = activeMode ?? internalMode;
  const [zoomIdx, setZoomIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  const zoom = ZOOM_LEVELS[zoomIdx] ?? 1.0;

  useEffect(() => {
    if (activeMode && activeMode !== internalMode) {
      restippleRef.current = 1.0;
      setInternalMode(activeMode);
    }
  }, [activeMode, internalMode]);

  const switchMode = (nextMode: FieldMode) => {
    if (nextMode !== mode) {
      restippleRef.current = 1.0;
      playScanPulse();
    } else {
      playTactileClick();
    }
    setInternalMode(nextMode);
    onModeChange?.(nextMode);
  };

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
      mode === "seat"
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
      accent: Boolean(p.accent),
    }));
    const sorted = [...projected];

    // Offscreen glyph cache for crisp 60fps rendering
    const spriteCanvas = document.createElement("canvas");
    const spriteCtx = spriteCanvas.getContext("2d");
    const uniqueChars = Array.from(
      new Set([...targetPhrase, ...GLYPHS, ...ACCENT_GLYPHS])
    );
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
      const yaw =
        mode === "seat"
          ? -0.34 + Math.sin(t * 0.38) * 0.58 + ptr.x * 0.85
          : t * 0.2 + ptr.x * 0.72;
      const pitch = 0.28 + ptr.y * 0.38 + Math.sin(t * 0.35) * 0.05;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      const project3D = (x3: number, y3: number, z3: number) => {
        const rx = x3 * cosY + z3 * sinY;
        const rz = z3 * cosY - x3 * sinY;
        const ry = y3 * cosP + rz * sinP;
        const depthZ = rz * cosP - y3 * sinP;
        const perspective = 2.85 / (2.85 - 0.42 * depthZ);
        return {
          x: cx + rx * radius * zoom * perspective,
          y: cy + ry * radius * zoom * perspective,
          z: depthZ,
        };
      };

      for (let i = 0; i < points.length; i += 1) {
        const src = points[i];
        const dst = projected[i];
        const p = project3D(src.x, src.y, src.z);
        dst.x = p.x;
        dst.y = p.y;
        dst.z = p.z;
      }

      sorted.sort((a, b) => a.z - b.z);

      // 1. Subtle stage background & blueprint grid
      ctx.save();
      const stageGlow = ctx.createRadialGradient(
        cx - ptr.x * 14,
        cy - ptr.y * 10,
        radius * 0.06,
        cx,
        cy,
        radius * 1.35
      );
      stageGlow.addColorStop(0, "rgba(59, 155, 255, 0.09)");
      stageGlow.addColorStop(0.52, "rgba(123, 216, 143, 0.024)");
      stageGlow.addColorStop(1, "rgba(6, 8, 5, 0)");
      ctx.fillStyle = stageGlow;
      ctx.fillRect(leftEdge, 16, rightEdge - leftEdge, bottomEdge - 16);

      const gridStep = compact ? 36 : 44;
      const parallaxX = -ptr.x * 6;
      const parallaxY = -ptr.y * 6;
      ctx.strokeStyle = "rgba(236, 232, 216, 0.025)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (
        let gx = cx + (parallaxX % gridStep);
        gx < rightEdge - 8;
        gx += gridStep
      ) {
        ctx.moveTo(gx, 20);
        ctx.lineTo(gx, bottomEdge - 24);
      }
      for (
        let gx = cx + (parallaxX % gridStep) - gridStep;
        gx > leftEdge + 8;
        gx -= gridStep
      ) {
        ctx.moveTo(gx, 20);
        ctx.lineTo(gx, bottomEdge - 24);
      }
      for (
        let gy = cy + (parallaxY % gridStep);
        gy < bottomEdge - 24;
        gy += gridStep
      ) {
        ctx.moveTo(leftEdge + 8, gy);
        ctx.lineTo(rightEdge - 8, gy);
      }
      for (
        let gy = cy + (parallaxY % gridStep) - gridStep;
        gy > 20;
        gy -= gridStep
      ) {
        ctx.moveTo(leftEdge + 8, gy);
        ctx.lineTo(rightEdge - 8, gy);
      }
      ctx.stroke();

      // 2. Draw 3D isometric vault pedestal & architectural frame
      const baseCorners = [
        project3D(-0.86, 0.86, -0.86),
        project3D(0.86, 0.86, -0.86),
        project3D(0.86, 0.86, 0.86),
        project3D(-0.86, 0.86, 0.86),
      ];
      ctx.strokeStyle = "rgba(236, 232, 216, 0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 0; c < 4; c += 1) {
        const b0 = baseCorners[c];
        const b1 = baseCorners[(c + 1) % 4];
        ctx.moveTo(b0.x, b0.y);
        ctx.lineTo(b1.x, b1.y);
      }
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
          dist < 84 ? Math.max(0, 1 - dist / 84) * ptr.glow * (pt.z + 1.1) * 0.72 : 0;
        const pulseWave =
          ptr.pulse > 0.01
            ? Math.max(
                0,
                1 - Math.abs(Math.hypot(pt.x - cx, pt.y - cy) - (1 - ptr.pulse) * radius * 1.45) / 32
              ) * ptr.pulse
            : 0;

        const alpha = Math.min(
          1,
          (pt.accent ? 0.26 : 0.1) +
            (pt.z + 1) * (pt.accent ? 0.38 : 0.28) +
            proximity * 0.58 +
            pulseWave * 0.55
        );
        ctx.globalAlpha = alpha;

        const depthLevel = Math.min(3, Math.max(0, Math.round((pt.z + 1) * 1.5)));
        const palette =
          pulseWave > 0.16
            ? 2
            : proximity > 0.14 || pt.accent
              ? 1
              : 0;
        const row = palette * 4 + depthLevel;
        const col = charToCol.get(pt.letter) ?? 0;

        ctx.drawImage(
          spriteCanvas,
          col * cellPx * dpr,
          row * cellPx * dpr,
          cellPx * dpr,
          cellPx * dpr,
          pt.x - cellPx / 2,
          pt.y - cellPx / 2 + pulseWave * -5,
          cellPx,
          cellPx
        );
      }

      ctx.globalAlpha = 1;

      // TONASY99 Restipple cellular matrix transition wave on mode switch
      if (restippleRef.current > 0.01) {
        const prog = 1 - restippleRef.current;
        const cell = 24;
        const cols = Math.ceil((rightEdge - leftEdge) / cell);
        const rows = Math.ceil((bottomEdge - 16) / cell);
        ctx.save();
        ctx.font = `500 10px "Geist Mono", "IBM Plex Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let r = 0; r < rows; r += 1) {
          for (let c = 0; c < cols; c += 1) {
            const diag = (c / Math.max(1, cols) + r / Math.max(1, rows)) * 0.5;
            const delta = Math.abs(prog * 1.35 - diag);
            if (delta < 0.24) {
              const cxCell = leftEdge + c * cell + cell / 2;
              const cyCell = 16 + r * cell + cell / 2;
              const intensity = 1 - delta / 0.24;
              ctx.globalAlpha = intensity * 0.72;
              if ((r + c) % 3 === 0) {
                ctx.strokeStyle = SIGNAL;
                ctx.lineWidth = 0.8;
                ctx.strokeRect(cxCell - 4.5, cyCell - 4.5, 9, 9);
              } else if ((r + c) % 3 === 1) {
                ctx.fillStyle = POSITIVE;
                ctx.fillRect(cxCell - 2.5, cyCell - 2.5, 5, 5);
              } else {
                ctx.fillStyle = PAPER;
                ctx.fillText("⊞", cxCell, cyCell);
              }
            }
          }
        }
        ctx.restore();
      }
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
        if (restippleRef.current > 0.005) {
          restippleRef.current = Math.max(0, restippleRef.current - dt * 1.65);
        } else {
          restippleRef.current = 0;
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
  }, [mode, zoom, paused, reduced, compact]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded border border-line bg-ink-deep",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
            Keyless vault
          </span>
          <span className="font-mono text-[9px] text-signal">
            {mode === "seat" ? "01/03" : mode === "cube" ? "02/03" : "03/03"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {(["seat", "cube", "prism"] as const).map((item, idx) => (
            <button
              key={item}
              type="button"
              onClick={() => switchMode(item)}
              aria-pressed={mode === item}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-label transition-colors",
                mode === item
                  ? "border-signal bg-signal-soft text-paper"
                  : "border-line bg-surface-sunken text-paper-muted hover:border-line-strong hover:text-paper"
              )}
            >
              <span className="mr-1 text-[8px] opacity-65">0{idx + 1}</span>
              {item}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              playTactileClick();
              setZoomIdx((prev) => (prev + 1) % ZOOM_LEVELS.length);
            }}
            aria-label={`Cycle vault zoom level (currently ${zoom.toFixed(2)}x)`}
            className="inline-flex items-center gap-1 rounded border border-line bg-surface-sunken px-2 py-0.5 font-mono text-[9px] uppercase tracking-label text-paper-muted transition-colors hover:border-line-strong hover:text-paper"
          >
            <ZoomIn className="h-2.5 w-2.5 text-signal" aria-hidden="true" />
            {zoom.toFixed(2)}×
          </button>

          <button
            type="button"
            onClick={() => {
              playTactileClick();
              setPaused((p) => !p);
            }}
            disabled={reduced}
            aria-label={
              reduced
                ? "Motion disabled by system preference"
                : paused
                  ? "Resume ASCII animation"
                  : "Pause ASCII animation"
            }
            className="ml-0.5 inline-flex items-center gap-1 rounded border border-line bg-surface-sunken px-2 py-0.5 font-mono text-[9px] uppercase tracking-label text-paper-muted transition-colors hover:border-line-strong hover:text-paper disabled:opacity-50"
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
          compact ? "h-[260px]" : "h-[340px] sm:h-[370px]"
        )}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-crosshair touch-pan-y"
          role="img"
          aria-label="Interactive 3D ASCII character field representing Logen keyless seat vaults on NEAR. Move pointer or click to interact."
        />
      </div>
    </div>
  );
}
