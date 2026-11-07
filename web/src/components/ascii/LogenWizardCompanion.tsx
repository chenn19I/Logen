"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sparkles, Wand2, Zap, X } from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { castAsciiSpell } from "./AsciiSpellEngine";

type WizardMood = "calm" | "lifted" | "casting" | "riding" | "happy" | "sleeping";

const PAGE_SPELLS: Record<
  string,
  {
    greeting: string;
    inspectTip: string;
    actionLabel: string;
  }
> = {
  "/": {
    greeting: "Keeper of the keyless seats. Drag me anywhere or cast a rune.",
    inspectTip: "Every seat owns a sub-account with 0 keys. Sell the NFT, the NEAR inside moves with it.",
    actionLabel: "Verify 5 checks",
  },
  "/lounge": {
    greeting: "Guarding the North Door. Only the live seat holder may enter.",
    inspectTip: "The lounge re-checks the seat owner every 5 seconds. Old cookies die on transfer.",
    actionLabel: "Test door check",
  },
  "/market": {
    greeting: "Inspecting the market escrow. Drop me on any seat card to audit it.",
    inspectTip: "Buyers lock min_balance & nonce. If the seller drains 1 yoctoNEAR, the sale aborts.",
    actionLabel: "Highlight best seat",
  },
  "/mint": {
    greeting: "Ready to forge a new seat and deploy its keyless vault.",
    inspectTip: "Minting deploys the NEP-171 token and a 0-key sub-account in one transaction.",
    actionLabel: "Conjure seat name",
  },
  "/lab": {
    greeting: "12 villain attacks stand before us. Drop me on any row to zap it!",
    inspectTip: "All 12 cross-contract race conditions are blocked by frozen state & sequence numbers.",
    actionLabel: "Zap all 12 attacks",
  },
  "/verify": {
    greeting: "Reading the five on-chain proofs directly from NEAR.",
    inspectTip: "Zero FullAccess keys, zero FunctionCall keys, pinned WASM code hash.",
    actionLabel: "Re-check all 5",
  },
  "/seats": {
    greeting: "Surveying the full club roll. Pick me up to inspect any seat.",
    inspectTip: "Each seat in the roll carries its own balance, earnings, and transfer sequence.",
    actionLabel: "Go to Mint",
  },
};

const LIFT_QUIPS = [
  "Whoa—careful with the wizard hat!",
  "Levitating! Drop me on any card to inspect it.",
  "High-altitude zero-key inspection!",
  "My staff is fully charged—drop me anywhere!",
];

export function LogenWizardCompanion() {
  const pathname = usePathname();
  const router = useRouter();
  const { accountId } = useNear();
  const { demo, setDemo } = useDemo();

  // Position offset from default bottom-right anchor (px)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [mood, setMood] = useState<WizardMood>("calm");
  const [menuOpen, setMenuOpen] = useState(false);
  const [speech, setSpeech] = useState<string>(
    "Hello! You can pick me up, drag me onto cards, or cast ASCII magic."
  );
  const [speechVisible, setSpeechVisible] = useState(true);
  const [eyeOffset, setEyeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dangleAngle, setDangleAngle] = useState(0);
  const [runeFrame, setRuneFrame] = useState(0);
  const [kickPhase, setKickPhase] = useState(0);

  const wizardRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    dragging: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    lastX: number;
    lastY: number;
  }>({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    lastX: 0,
    lastY: 0,
  });

  const pageConfig =
    PAGE_SPELLS[pathname] ??
    (pathname.startsWith("/seat/")
      ? {
          greeting: "Inspecting this seat's keyless vault and history.",
          inspectTip: "Only the current NFT holder can move the NEAR locked inside this seat.",
          actionLabel: "Verify 5 checks",
        }
      : PAGE_SPELLS["/"]);

  // Subtle ASCII pedestal animation & dangling leg kick when lifted
  useEffect(() => {
    const interval = window.setInterval(() => {
      setRuneFrame((f) => (f + 1) % 8);
      if (mood === "lifted") {
        setKickPhase((k) => (k + 1) % 2);
      }
    }, 180);
    return () => window.clearInterval(interval);
  }, [mood]);

  // Greet on route change with a teleportation rune burst
  useEffect(() => {
    if (mood === "sleeping") return;
    const cfg =
      PAGE_SPELLS[pathname] ??
      (pathname.startsWith("/seat/")
        ? {
            greeting: "Inspecting this seat's keyless vault and history.",
            inspectTip: "Only the current NFT holder can move the NEAR locked inside this seat.",
            actionLabel: "Verify 5 checks",
          }
        : PAGE_SPELLS["/"]);
    setSpeech(cfg.greeting);
    setSpeechVisible(true);
    setMood("happy");
    const timer = window.setTimeout(() => {
      setMood((m) => (m === "happy" ? "calm" : m));
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [pathname, mood]);

  // Track pointer for wizard eyes & handle dragging
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let scrollTimeout = 0;

    const onPointerMove = (e: PointerEvent) => {
      const el = wizardRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.max(1, Math.hypot(dx, dy));
        setEyeOffset({
          x: Math.round((dx / dist) * 2.4),
          y: Math.round((dy / dist) * 1.8),
        });
      }

      const st = dragStateRef.current;
      if (!st.dragging) return;

      const dxTotal = e.clientX - st.startX;
      const dyTotal = e.clientY - st.startY;
      if (Math.hypot(dxTotal, dyTotal) > 5) {
        st.moved = true;
      }

      const vx = e.clientX - st.lastX;
      st.lastX = e.clientX;
      st.lastY = e.clientY;

      // Swing wizard body based on horizontal drag velocity
      setDangleAngle(Math.max(-22, Math.min(22, vx * 1.35)));

      // Clamp inside viewport
      const maxLeft = -(window.innerWidth - 110);
      const maxTop = -(window.innerHeight - 130);
      const nextX = Math.max(maxLeft, Math.min(20, st.originX + dxTotal));
      const nextY = Math.max(maxTop, Math.min(20, st.originY + dyTotal));
      setPos({ x: nextX, y: nextY });

      // Emit light ASCII sparks while carrying the wizard
      if (Math.random() > 0.55) {
        castAsciiSpell({
          x: e.clientX,
          y: e.clientY + 24,
          intensity: 0.42,
          tone: "signal",
        });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const st = dragStateRef.current;
      if (!st.dragging) return;
      st.dragging = false;
      setDangleAngle(0);

      if (st.moved) {
        // Landing spell shockwave!
        castAsciiSpell({
          x: e.clientX,
          y: e.clientY,
          intensity: 1.05,
          tone: "positive",
        });
        setMood("happy");
        window.setTimeout(() => setMood("calm"), 900);

        // Inspect element underneath where the wizard was dropped
        const wizardEl = wizardRef.current;
        if (wizardEl) {
          wizardEl.style.pointerEvents = "none";
          const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
          wizardEl.style.pointerEvents = "auto";

          if (under) {
            const cardText = under.closest("button, a, section, [class*='Panel']")?.textContent?.trim();
            const tryBtn = under.closest("div")?.querySelector("button[aria-label^='Try attack']") as HTMLButtonElement | null;
            if (tryBtn) {
              tryBtn.click();
              setSpeech("Zapped that attack vector with my staff! Blocked by the vault.");
              setSpeechVisible(true);
              return;
            }
            if (cardText && cardText.length > 0) {
              const snippet = cardText.replace(/\s+/g, " ").slice(0, 54);
              setSpeech(`Inspected: "${snippet}…" — Sealed & verified!`);
              setSpeechVisible(true);
              return;
            }
          }
        }

        setSpeech("Landed safely! Click me to cast a spell or run a quick action.");
        setSpeechVisible(true);
      } else {
        setMood("calm");
      }
    };

    const onScroll = () => {
      if (dragStateRef.current.dragging) return;
      const dy = Math.abs(window.scrollY - lastScrollY);
      lastScrollY = window.scrollY;
      if (dy > 18 && mood === "calm") {
        setMood("riding");
        window.clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
          setMood((m) => (m === "riding" ? "calm" : m));
        }, 450);
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(scrollTimeout);
    };
  }, [mood]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-wizard-menu]")) return;
    e.stopPropagation();
    const st = dragStateRef.current;
    st.dragging = true;
    st.moved = false;
    st.startX = e.clientX;
    st.startY = e.clientY;
    st.originX = pos.x;
    st.originY = pos.y;
    st.lastX = e.clientX;
    st.lastY = e.clientY;

    if (mood !== "sleeping") {
      setMood("lifted");
      const quip = LIFT_QUIPS[Math.floor(Math.random() * LIFT_QUIPS.length)];
      setSpeech(quip);
      setSpeechVisible(true);
    }
  };

  const handleWizardClick = (e: React.MouseEvent) => {
    if (dragStateRef.current.moved) return;
    if (mood === "sleeping") {
      setMood("happy");
      setSpeech("Awake and ready! Where shall we cast our next rune?");
      setSpeechVisible(true);
      castAsciiSpell({ x: e.clientX, y: e.clientY, intensity: 0.9, tone: "signal" });
      window.setTimeout(() => setMood("calm"), 800);
      return;
    }
    setMenuOpen((prev) => !prev);
    setSpeechVisible(true);
    castAsciiSpell({ x: e.clientX, y: e.clientY, intensity: 0.75, tone: "signal" });
  };

  // Spell 1: Grand Arcane Constellation
  const castGrandRune = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMood("casting");
    setSpeech(pageConfig.inspectTip);
    setSpeechVisible(true);

    const rect = wizardRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : e.clientX;
    const cy = rect ? rect.top : e.clientY;

    castAsciiSpell({ x: cx, y: cy, intensity: 1.35, tone: "signal" });
    window.setTimeout(() => {
      castAsciiSpell({
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.42,
        intensity: 1.3,
        tone: "positive",
      });
    }, 180);
    window.setTimeout(() => setMood("calm"), 1100);
  };

  // Spell 2: Contextual Page Power Move
  const runPageAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMood("casting");
    castAsciiSpell({ x: e.clientX, y: e.clientY, intensity: 1.2, tone: "positive" });

    // If user is neither in demo nor connected, summon Demo Mode immediately!
    if (!demo && !accountId && pathname !== "/lab") {
      setDemo(true);
      setSpeech("✨ Summoned Demo Mode! Seat #01 (2.46 NEAR inside) is now active in your wallet.");
      setSpeechVisible(true);
      window.setTimeout(() => setMood("calm"), 1000);
      return;
    }

    if (pathname === "/lab") {
      const buttons = Array.from(document.querySelectorAll("button"));
      const runAllBtn = buttons.find((b) => b.textContent?.includes("Run all 12"));
      if (runAllBtn) {
        runAllBtn.click();
        setSpeech("⚡ Zapping all 12 villain attacks! Watch the defense matrix light up.");
      } else {
        setSpeech("All 12 attacks are blocked by the keyless seat vault!");
      }
    } else if (pathname === "/verify") {
      const buttons = Array.from(document.querySelectorAll("button"));
      const recheckBtn = buttons.find((b) => b.textContent?.includes("Re-check all"));
      recheckBtn?.click();
      setSpeech("✦ Re-checking all 5 on-chain proofs against NEAR!");
    } else if (pathname === "/mint") {
      const nameInput = document.querySelector("input[type='text']") as HTMLInputElement | null;
      if (nameInput) {
        const names = ["Arcane Keeper", "Rune Weaver", "Cobalt Magus", "Obsidian Sage"];
        const pick = names[Math.floor(Math.random() * names.length)];
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(nameInput, pick);
        nameInput.dispatchEvent(new Event("input", { bubbles: true }));
        nameInput.focus();
        setSpeech(`✦ Inscribed "${pick}" into the minting scroll!`);
      } else {
        setSpeech("Upload a portrait or pick a name to mint your keyless seat!");
      }
    } else if (pathname === "/market") {
      const buyBtns = Array.from(document.querySelectorAll("button")).filter((b) =>
        b.textContent?.includes("Buy this seat")
      );
      if (buyBtns[0]) {
        buyBtns[0].scrollIntoView({ behavior: "smooth", block: "center" });
        setSpeech("✦ Found an active seat listing! Its NEAR inside moves with the purchase.");
      } else {
        setSpeech("All listed seats lock their balance in escrow during the sale.");
      }
    } else if (pathname === "/lounge") {
      const enterBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Enter with seat") || b.textContent?.includes("Sign to enter")
      );
      if (enterBtn) {
        enterBtn.click();
        setSpeech("✦ Opening the North Door with your seat credential!");
      } else {
        setSpeech("The room is open! Your seat is verified on the door list.");
      }
    } else {
      router.push("/verify");
      setSpeech("✦ Teleporting to the 5-check vault verifier!");
    }

    setSpeechVisible(true);
    window.setTimeout(() => setMood("calm"), 1000);
  };

  // Spell 3: Playful Anti-Gravity Levitation Toss
  const levitateToss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMood("lifted");
    setSpeech("Wheee! Zero-key anti-gravity jump!");
    setSpeechVisible(true);

    const jumpY = Math.max(-(window.innerHeight - 220), pos.y - 180);
    const jumpX = Math.max(-(window.innerWidth - 180), Math.min(0, pos.x + (Math.random() - 0.5) * 160));
    setPos({ x: jumpX, y: jumpY });

    castAsciiSpell({
      x: e.clientX,
      y: e.clientY - 80,
      intensity: 1.15,
      tone: "signal",
    });

    window.setTimeout(() => {
      setPos((p) => ({ x: p.x, y: 0 }));
      setMood("happy");
      window.setTimeout(() => setMood("calm"), 700);
    }, 650);
  };

  const pedestalRunes = [
    "· ∘ ⊹ ✦ ⊹ ∘ ·",
    "∘ ⊹ ✦ ✧ ✦ ⊹ ∘",
    "⊹ ✦ ✧ ⟡ ✧ ✦ ⊹",
    "✦ ✧ ⟡ ✦ ⟡ ✧ ✦",
    "✧ ⟡ ✦ ⊹ ✦ ⟡ ✧",
    "⟡ ✦ ⊹ ∘ ⊹ ✦ ⟡",
    "✦ ⊹ ∘ · ∘ ⊹ ✦",
    "⊹ ∘ · ∘ · ∘ ⊹",
  ][runeFrame];

  if (mood === "sleeping") {
    return (
      <div className="fixed bottom-4 right-4 z-50 select-none">
        <button
          type="button"
          onClick={handleWizardClick}
          className="group flex items-center gap-2 rounded-full border border-line bg-surface/95 px-3 py-1.5 font-mono text-[11px] text-paper-muted shadow-lg backdrop-blur-md transition-all hover:border-signal hover:text-paper"
          title="Wake up Logen Wizard Companion"
        >
          <span className="text-signal transition-transform group-hover:-translate-y-0.5">▲</span>
          <span>✦ zZz</span>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      ref={wizardRef}
      animate={{
        x: pos.x,
        y: pos.y,
        rotate: mood === "lifted" ? dangleAngle : mood === "riding" ? -6 : 0,
        scale: mood === "lifted" ? 1.08 : mood === "casting" ? 1.05 : 1,
      }}
      transition={
        dragStateRef.current.dragging
          ? { type: "tween", duration: 0.02 }
          : { type: "spring", stiffness: 280, damping: 20 }
      }
      style={{ touchAction: "none" }}
      className="fixed bottom-5 right-5 z-50 select-none"
    >
      {/* Speech Bubble & Spell Bar */}
      <AnimatePresence>
        {(speechVisible || menuOpen) && (
          <motion.div
            data-wizard-menu="true"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-[108px] right-0 w-[268px] rounded border border-line-strong bg-surface/95 p-3 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-[9px] uppercase tracking-label text-signal">
                ✦ Logen Familiar · {mood === "lifted" ? "Levitating" : "Ready"}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSpeechVisible(false);
                  setMenuOpen(false);
                }}
                className="text-paper-muted hover:text-paper"
                aria-label="Hide wizard message"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            <p className="mt-1.5 text-12 leading-relaxed text-paper">
              {speech}
            </p>

            {/* Interactive Spell Buttons */}
            <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-line pt-2.5 font-mono text-[9px] uppercase tracking-label">
              <button
                type="button"
                onClick={castGrandRune}
                className="inline-flex items-center justify-center gap-1 rounded border border-line bg-ink-deep px-2 py-1.5 text-paper-dim transition-colors hover:border-signal hover:text-paper"
              >
                <Sparkles className="h-2.5 w-2.5 text-signal" />
                Cast Rune
              </button>
              <button
                type="button"
                onClick={runPageAction}
                className="inline-flex items-center justify-center gap-1 rounded border border-signal/50 bg-signal-soft px-2 py-1.5 text-paper transition-colors hover:border-signal"
              >
                <Zap className="h-2.5 w-2.5 text-signal" />
                {!demo && !accountId && pathname !== "/lab"
                  ? "Summon Demo"
                  : pageConfig.actionLabel}
              </button>
              <button
                type="button"
                onClick={levitateToss}
                className="inline-flex items-center justify-center gap-1 rounded border border-line bg-ink-deep px-2 py-1.5 text-paper-dim transition-colors hover:border-line-strong hover:text-paper"
              >
                <Wand2 className="h-2.5 w-2.5 text-positive" />
                Jump / Toss
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setMood("sleeping");
                }}
                className="inline-flex items-center justify-center gap-1 rounded border border-line bg-ink-deep px-2 py-1.5 text-paper-muted transition-colors hover:border-line-strong hover:text-paper"
              >
                <Moon className="h-2.5 w-2.5" />
                Rest
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draggable / Liftable Cyber-Wizard Body */}
      <div
        onPointerDown={handlePointerDown}
        onClick={handleWizardClick}
        role="button"
        tabIndex={0}
        aria-label="Logen Wizard Companion. Drag to pick up and carry, or click to cast spells."
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setMenuOpen((o) => !o);
            setSpeechVisible(true);
          }
        }}
        className={`group relative flex flex-col items-center rounded-xl border px-3 py-2 backdrop-blur-md transition-colors ${
          mood === "lifted"
            ? "cursor-grabbing border-signal bg-surface shadow-[0_14px_34px_rgba(232,90,42,0.28)]"
            : "cursor-grab border-line-strong bg-surface/90 shadow-lg hover:border-signal"
        }`}
      >
        {/* Floating Star Tip above Hat */}
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="font-mono text-[10px] leading-none text-signal"
          aria-hidden="true"
        >
          {mood === "casting" ? "✶ ✦ ✶" : "✦"}
        </motion.div>

        {/* Wizard Hat + Staff + Cyber-Visor */}
        <div className="relative mt-0.5 flex items-center gap-1.5">
          {/* Arcane Staff on Left */}
          <motion.div
            animate={
              mood === "casting"
                ? { rotate: [-12, 18, -8, 0], y: [-4, 0] }
                : { y: [0, -2, 0] }
            }
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center font-mono text-[10px] leading-none text-positive"
            aria-hidden="true"
          >
            <span>⟡</span>
            <span className="text-paper-muted">│</span>
            <span className="text-paper-muted">╵</span>
          </motion.div>

          {/* Wizard Sprite Core */}
          <div className="flex flex-col items-center">
            {/* Pointed Wizard Hat */}
            <div
              className="font-mono text-[11px] leading-[0.85] text-signal"
              aria-hidden="true"
            >
              <div>╱▲╲</div>
              <div className="text-[10px] text-paper-dim">═════</div>
            </div>

            {/* Cyber-Visor Face with Cursor-Tracking Eyes */}
            <div className="mt-0.5 flex h-5 w-11 items-center justify-center rounded-sm border border-[rgba(77,232,255,0.35)] bg-[#050a14] px-1">
              <span
                style={{
                  transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                }}
                className="flex items-center gap-1.5 font-mono text-[10px] leading-none text-[#4de8ff] transition-transform duration-75"
                aria-hidden="true"
              >
                {mood === "lifted" ? (
                  <>
                    <span>◎</span>
                    <span>◎</span>
                  </>
                ) : mood === "casting" || mood === "happy" ? (
                  <>
                    <span className="text-positive">✦</span>
                    <span className="text-positive">✦</span>
                  </>
                ) : (
                  <>
                    <span>◉</span>
                    <span>◉</span>
                  </>
                )}
              </span>
            </div>

            {/* Robe & Dangling Feet */}
            <div
              className="mt-0.5 font-mono text-[10px] leading-[0.95] text-paper-dim"
              aria-hidden="true"
            >
              <div>╱ ⟡ ╲</div>
              {mood === "lifted" ? (
                <div className="text-signal">
                  {kickPhase === 0 ? "╯   ╰" : "╰   ╯"}
                </div>
              ) : (
                <div className="text-[9px] text-paper-muted">╨───╨</div>
              )}
            </div>
          </div>
        </div>

        {/* Live ASCII Levitation Rune Pedestal */}
        <div
          className="mt-1 font-mono text-[8px] tracking-tighter text-paper-muted group-hover:text-signal"
          aria-hidden="true"
        >
          {pedestalRunes}
        </div>
      </div>
    </motion.div>
  );
}
