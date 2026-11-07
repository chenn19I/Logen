"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export interface SpellBurstOptions {
  x?: number;
  y?: number;
  intensity?: number;
  tone?: "signal" | "positive" | "paper";
}

const SPELL_EVENT = "logen:ascii-spell";
const RUNE_CHARS = ["·", "∘", "∶", "⊹", "✦", "✧", "⟡", "⊞", "✶", "⋆"];

/**
 * Triggers a localized or full-screen ASCII wizard spell animation.
 * Safe to call from any client component handler.
 */
export function castAsciiSpell(options: SpellBurstOptions = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SpellBurstOptions>(SPELL_EVENT, { detail: options }));
}

interface GlyphParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  tone: "signal" | "positive" | "paper";
  phase: number;
  size: number;
}

interface SpellWave {
  cx: number;
  cy: number;
  radius: number;
  maxRadius: number;
  speed: number;
  tone: "signal" | "positive" | "paper";
  alpha: number;
}

/**
 * Calm, scroll-reactive and transition-reactive ASCII spell canvas.
 * Dormant and silent when the user is still; awakens with arcane ASCII glyphs
 * when scrolling, switching features, or changing pages.
 */
export function AsciiSpellCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pathname = usePathname();
  const prevPathRef = useRef<string>(pathname);
  const spawnSpellRef = useRef<((opts: SpellBurstOptions, isRouteSweep?: boolean) => void) | null>(
    null
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mqReduced.matches) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const particles: GlyphParticle[] = [];
    const waves: SpellWave[] = [];
    let rafId = 0;
    let lastScrollY = window.scrollY;
    let lastPointerX = width * 0.5;
    let lastPointerY = height * 0.35;
    let pointerDistAccum = 0;

    const addParticle = (
      x: number,
      y: number,
      vx: number,
      vy: number,
      maxLife: number,
      tone: "signal" | "positive" | "paper" = "signal",
      size = 13
    ) => {
      if (particles.length > 160) particles.shift();
      particles.push({
        x,
        y,
        vx,
        vy,
        life: 0,
        maxLife,
        tone,
        phase: Math.random() * Math.PI * 2,
        size,
      });
    };

    const startLoop = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(render);
      }
    };

    const spawnSpell = (opts: SpellBurstOptions = {}, isRouteSweep = false) => {
      const cx = opts.x ?? lastPointerX ?? width * 0.5;
      const cy = opts.y ?? lastPointerY ?? height * 0.38;
      const tone = opts.tone ?? "signal";
      const intensity = opts.intensity ?? 1;

      waves.push({
        cx,
        cy,
        radius: 8,
        maxRadius: isRouteSweep ? Math.max(width, height) * 0.72 : 210 * intensity,
        speed: isRouteSweep ? 16 : 7.5,
        tone,
        alpha: isRouteSweep ? 0.65 : 0.55,
      });

      const count = Math.round((isRouteSweep ? 42 : 22) * intensity);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
        const speed = (isRouteSweep ? 2.2 : 1.1) + Math.random() * 2.4;
        const dist = isRouteSweep ? Math.random() * 90 : Math.random() * 18;
        addParticle(
          cx + Math.cos(angle) * dist,
          cy + Math.sin(angle) * dist,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 0.45,
          34 + Math.floor(Math.random() * 26),
          i % 3 === 0 ? "paper" : tone,
          isRouteSweep ? 14 : 13
        );
      }
      startLoop();
    };

    spawnSpellRef.current = spawnSpell;

    const onScroll = () => {
      const currentY = window.scrollY;
      const dy = currentY - lastScrollY;
      lastScrollY = currentY;
      const absDy = Math.abs(dy);
      if (absDy < 2) return;

      // Spawn calm arcane ASCII runes along the sides and across the viewport as user scrolls
      const count = Math.min(7, Math.max(2, Math.floor(absDy / 12)));
      const dir = dy > 0 ? -1 : 1;

      for (let i = 0; i < count; i++) {
        // Favor the calm left/right margins and subtle mid-screen streams
        const lane = Math.random();
        let x: number;
        if (lane < 0.42) {
          x = 24 + Math.random() * Math.max(80, width * 0.18);
        } else if (lane < 0.84) {
          x = width - 24 - Math.random() * Math.max(80, width * 0.18);
        } else {
          x = width * (0.25 + Math.random() * 0.5);
        }
        const y = Math.random() * height;
        const vy = dir * (0.7 + Math.random() * 1.4);
        const vx = (Math.random() - 0.5) * 0.55;
        addParticle(
          x,
          y,
          vx,
          vy,
          36 + Math.floor(Math.random() * 28),
          i % 2 === 0 ? "signal" : "paper",
          13
        );
      }
      startLoop();
    };

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      pointerDistAccum += Math.hypot(dx, dy);

      if (pointerDistAccum > 58) {
        pointerDistAccum = 0;
        addParticle(
          e.clientX + (Math.random() - 0.5) * 12,
          e.clientY + (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 0.45,
          -0.55 - Math.random() * 0.45,
          28 + Math.floor(Math.random() * 16),
          Math.random() > 0.45 ? "signal" : "paper",
          12
        );
        startLoop();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      // Gentle mini-burst on click anywhere interactive
      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a, [role='button'], input, label")) {
        spawnSpell({ x: e.clientX, y: e.clientY, intensity: 0.72 });
      }
    };

    const onCustomSpell = (e: Event) => {
      const custom = e as CustomEvent<SpellBurstOptions>;
      spawnSpell(custom.detail ?? {}, false);
    };

    const toneRgb = (tone: "signal" | "positive" | "paper") => {
      if (tone === "positive") return "123, 216, 143";
      if (tone === "paper") return "236, 232, 216";
      return "232, 90, 42";
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Draw expanding ASCII rune rings (spell waves)
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        w.radius += w.speed;
        const progress = w.radius / w.maxRadius;
        if (progress >= 1) {
          waves.splice(i, 1);
          continue;
        }
        const alpha = (1 - progress) * w.alpha;
        const circumference = 2 * Math.PI * w.radius;
        const stepCount = Math.min(36, Math.max(12, Math.floor(circumference / 28)));
        ctx.font = "500 12px 'Geist Mono', monospace";
        ctx.fillStyle = `rgba(${toneRgb(w.tone)}, ${alpha.toFixed(3)})`;

        for (let s = 0; s < stepCount; s++) {
          const theta = (s / stepCount) * Math.PI * 2 + progress * 1.6;
          const gx = w.cx + Math.cos(theta) * w.radius;
          const gy = w.cy + Math.sin(theta) * w.radius;
          if (gx < -20 || gx > width + 20 || gy < -20 || gy > height + 20) continue;
          const glyphIdx =
            (s + Math.floor(progress * RUNE_CHARS.length * 2)) % RUNE_CHARS.length;
          ctx.fillText(RUNE_CHARS[glyphIdx], gx, gy);
        }
      }

      // Draw drifting ASCII rune particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += 1;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        const t = p.life / p.maxLife;
        // Gentle curl/wave drift like floating embers/magic runes
        p.x += p.vx + Math.sin(p.phase + t * 5) * 0.28;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy *= 0.985;

        const fade = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
        const alpha = Math.max(0, Math.min(1, fade * 0.72));

        // Morph glyph from bright star -> rune -> quiet dot as it fades
        const runeIndex = Math.min(
          RUNE_CHARS.length - 1,
          Math.max(0, Math.floor((1 - t) * (RUNE_CHARS.length - 1)))
        );
        const char = RUNE_CHARS[runeIndex];

        ctx.font = `500 ${p.size}px 'Geist Mono', monospace`;
        ctx.fillStyle = `rgba(${toneRgb(p.tone)}, ${alpha.toFixed(3)})`;
        ctx.fillText(char, p.x, p.y);
      }

      if (particles.length > 0 || waves.length > 0) {
        rafId = requestAnimationFrame(render);
      } else {
        rafId = 0;
      }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener(SPELL_EVENT, onCustomSpell);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener(SPELL_EVENT, onCustomSpell);
    };
  }, []);

  // Trigger a route-sweep spell whenever the user navigates between pages
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      spawnSpellRef.current?.(
        {
          x: typeof window !== "undefined" ? window.innerWidth * 0.5 : 600,
          y: 120,
          intensity: 1.15,
          tone: "signal",
        },
        true
      );
    }
  }, [pathname]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 select-none"
    />
  );
}

/**
 * Text component that materializes by weaving through arcane ASCII symbols
 * (`· ∘ ⊹ ✦ ✧ ⟡`) when it enters the viewport on scroll or when its text changes.
 */
export function AsciiSpellText({
  text,
  className,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "div";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [display, setDisplay] = useState(text);
  const hasAnimatedRef = useRef(false);

  const runDecode = React.useCallback((targetText: string) => {
    if (typeof window === "undefined") return;
    const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mqReduced.matches) {
      setDisplay(targetText);
      return;
    }

    const totalFrames = 18;
    let frame = 0;
    const chars = targetText.split("");

    const timer = window.setInterval(() => {
      frame += 1;
      const progress = frame / totalFrames;
      if (progress >= 1) {
        setDisplay(targetText);
        window.clearInterval(timer);
        return;
      }

      const next = chars
        .map((ch, idx) => {
          if (ch === " ") return " ";
          const charThreshold = (idx / Math.max(1, chars.length)) * 0.72;
          if (progress >= charThreshold + 0.28) return ch;
          if (progress < charThreshold) {
            return RUNE_CHARS[(idx + frame) % 4];
          }
          return RUNE_CHARS[3 + ((idx + frame) % (RUNE_CHARS.length - 3))];
        })
        .join("");

      setDisplay(next);
    }, 24);

    return () => window.clearInterval(timer);
  }, []);

  // Re-weave whenever the `text` prop changes
  useEffect(() => {
    if (hasAnimatedRef.current) {
      return runDecode(text);
    }
  }, [text, runDecode]);

  // Weave when scrolling into the viewport for the first time
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimatedRef.current) {
            hasAnimatedRef.current = true;
            runDecode(text);
          }
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [text, runDecode]);

  return React.createElement(
    Tag,
    {
      ref,
      className,
      "aria-label": text,
    },
    display
  );
}

/**
 * Calm horizontal ASCII rune thread that shimmers with a traveling wave as you scroll.
 */
export function AsciiRuneDivider({ className = "" }: { className?: string }) {
  const [scrollPhase, setScrollPhase] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrollPhase(Math.floor(window.scrollY / 18));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const slots = 29;
  const center = Math.floor(slots / 2);
  const activeWave = scrollPhase % slots;

  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center gap-1.5 overflow-hidden py-2 font-mono text-[11px] select-none ${className}`}
    >
      {Array.from({ length: slots }).map((_, i) => {
        const distFromWave = Math.min(
          Math.abs(i - activeWave),
          slots - Math.abs(i - activeWave)
        );
        const distFromCenter = Math.abs(i - center);

        let glyph = "·";
        let colorClass = "text-paper-muted/35";

        if (distFromWave === 0) {
          glyph = "✦";
          colorClass = "text-signal";
        } else if (distFromWave === 1) {
          glyph = "⊹";
          colorClass = "text-paper-dim";
        } else if (distFromCenter === 0) {
          glyph = "⟡";
          colorClass = "text-paper-muted/70";
        } else if (distFromCenter <= 3) {
          glyph = "∘";
          colorClass = "text-paper-muted/50";
        }

        return (
          <span key={i} className={`transition-colors duration-200 ${colorClass}`}>
            {glyph}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Wraps page content so route transitions materialize with a calm spring lift
 * and a brief arcane ASCII rune header shimmer.
 */
export function AsciiPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
    >
      {children}
    </motion.div>
  );
}

