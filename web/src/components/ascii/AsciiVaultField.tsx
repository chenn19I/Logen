"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type FieldMode = "seat" | "cube" | "prism";

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

export function AsciiVaultField({
  className,
  compact = false,
  initialMode = "seat",
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
          x: cx + rx * radius * perspective,
          y: cy + ry * radius * perspective,
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

      // 1. Clean terminal blueprint background inside the stage
      ctx.save();
      const stageGlow = ctx.createRadialGradient(
        cx - ptr.x * 14,
        cy - ptr.y * 10,
        radius * 0.06,
        cx,
        cy,
        radius * 1.35
      );
      stageGlow.addColorStop(0, "rgba(59, 155, 255, 0.085)");
      stageGlow.addColorStop(0.52, "rgba(123, 216, 143, 0.022)");
      stageGlow.addColorStop(1, "rgba(6, 8, 5, 0)");
      ctx.fillStyle = stageGlow;
      ctx.fillRect(leftEdge, 16, rightEdge - leftEdge, bottomEdge - 16);

      // Subtle orthogonal blueprint grid lines & top/bottom ruler ticks
      const gridStep = compact ? 36 : 44;
      const parallaxX = -ptr.x * 6;
      const parallaxY = -ptr.y * 6;
      ctx.strokeStyle = "rgba(236, 232, 216, 0.028)";
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

      // Ruler graduation ticks along top & bottom edges
      ctx.strokeStyle = "rgba(236, 232, 216, 0.09)";
      ctx.beginPath();
      for (let tx = leftEdge + 24; tx <= rightEdge - 24; tx += 16) {
        const isMajor = Math.round((tx - leftEdge) / 16) % 4 === 0;
        const tickLen = isMajor ? 5 : 2.5;
        ctx.moveTo(tx, 16);
        ctx.lineTo(tx, 16 + tickLen);
      }
      ctx.stroke();

      // Quadrant calibration '+' markers & top telemetry coordinates
      ctx.fillStyle = "rgba(236, 232, 216, 0.16)";
      ctx.font = '10px "Geist Mono", "IBM Plex Mono", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const calX = radius * 0.88;
      const calY = radius * 0.56;
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          ctx.fillText(
            "+",
            cx + sx * calX + parallaxX * 1.2,
            cy + sy * calY + parallaxY * 1.2
          );
        }
      }
      ctx.fillStyle = "rgba(141, 149, 133, 0.52)";
      ctx.font = '9px "Geist Mono", "IBM Plex Mono", monospace';
      ctx.textAlign = "left";
      ctx.fillText(
        `ISO.YAW ${yaw >= 0 ? "+" : ""}${yaw.toFixed(2)}`,
        leftEdge + 12,
        28
      );
      ctx.textAlign = "right";
      ctx.fillText(
        `PITCH +${pitch.toFixed(2)} // 60FPS`,
        rightEdge - 12,
        28
      );

      // 2. Draw 3D isometric vault pedestal & architectural frame (no circle/sphere)
      const baseCorners = [
        project3D(-0.86, 0.86, -0.86),
        project3D(0.86, 0.86, -0.86),
        project3D(0.86, 0.86, 0.86),
        project3D(-0.86, 0.86, 0.86),
      ];
      const topCorners = [
        project3D(-0.68, -0.86, -0.68),
        project3D(0.68, -0.86, -0.68),
        project3D(0.68, -0.86, 0.68),
        project3D(-0.68, -0.86, 0.68),
      ];
      ctx.strokeStyle = "rgba(236, 232, 216, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 0; c < 4; c += 1) {
        const b0 = baseCorners[c];
        const b1 = baseCorners[(c + 1) % 4];
        ctx.moveTo(b0.x, b0.y);
        ctx.lineTo(b1.x, b1.y);
      }
      // Pedestal cross-diagonals
      ctx.moveTo(baseCorners[0].x, baseCorners[0].y);
      ctx.lineTo(baseCorners[2].x, baseCorners[2].y);
      ctx.moveTo(baseCorners[1].x, baseCorners[1].y);
      ctx.lineTo(baseCorners[3].x, baseCorners[3].y);
      ctx.stroke();

      ctx.strokeStyle = "rgba(59, 155, 255, 0.09)";
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      for (let c = 0; c < 4; c += 1) {
        ctx.moveTo(baseCorners[c].x, baseCorners[c].y);
        ctx.lineTo(topCorners[c].x, topCorners[c].y);
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
          (pt.accent ? 0.24 : 0.09) +
            (pt.z + 1) * (pt.accent ? 0.36 : 0.28) +
            proximity * 0.55 +
            pulseWave * 0.5
        );
        ctx.globalAlpha = alpha;

        const depthLevel = Math.min(3, Math.max(0, Math.round((pt.z + 1) * 1.5)));
        const palette =
          pulseWave > 0.18
            ? 2
            : proximity > 0.15 || pt.accent
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
          pt.y - cellPx / 2,
          cellPx,
          cellPx
        );
      }

      ctx.globalAlpha = 1;

      // Target-lock leader lines & character extraction readout
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
          {(["seat", "cube", "prism"] as const).map((item) => (
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
          {mode === "seat"
            ? "Topology: 3D Club Seat Throne + Floating Keyless Vault"
            : mode === "cube"
              ? "Topology: 4D Tesseract Vault Cube · s007.logen.testnet"
              : "Topology: Octahedral Crystal Obelisk · rotation_seq"}
        </span>
        <span className="text-positive">NEP-171 + NEP-413 VERIFIED</span>
      </div>
    </div>
  );
}
