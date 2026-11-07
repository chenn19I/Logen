"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "logen.sound.v1";

let sharedCtx: AudioContext | null = null;
let soundEnabledState = false;
const listeners = new Set<(enabled: boolean) => void>();

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) {
    sharedCtx = new AudioCtx();
  }
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

export function isSoundEnabled(): boolean {
  return soundEnabledState;
}

export function setSoundEnabled(next: boolean): void {
  soundEnabledState = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Ignore storage errors
    }
  }
  listeners.forEach((fn) => fn(next));
  if (next) {
    playTactileClick(true);
  }
}

export function playTactileClick(force = false): void {
  if (!force && !soundEnabledState) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.024);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.026);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.028);
  } catch {
    // Ignore audio context restrictions
  }
}

export function playScanPulse(): void {
  if (!soundEnabledState) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(1040, now + 0.085);

    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // Ignore
  }
}

export function playBlockedThud(): void {
  if (!soundEnabledState) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(72, now + 0.09);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.105);
  } catch {
    // Ignore
  }
}

export function playSuccessChime(): void {
  if (!soundEnabledState) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [523.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const start = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.04, start);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    });
  } catch {
    // Ignore
  }
}

export function useSound() {
  const [enabled, setEnabled] = useState<boolean>(soundEnabledState);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "1" && !soundEnabledState) {
        soundEnabledState = true;
        setEnabled(true);
      }
    } catch {
      // Ignore
    }
    const listener = (val: boolean) => setEnabled(val);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const toggle = useCallback(() => {
    setSoundEnabled(!soundEnabledState);
  }, []);

  return {
    soundEnabled: enabled,
    toggleSound: toggle,
    playTactileClick,
    playScanPulse,
    playBlockedThud,
    playSuccessChime,
  };
}
