import React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "positive" | "caution" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-transparent text-paper-muted",
  accent: "border-[rgba(59,155,255,0.4)] bg-signal-soft text-signal-strong",
  positive: "border-[rgba(123,216,143,0.35)] bg-positive-soft text-positive",
  caution: "border-[rgba(230,180,80,0.35)] bg-caution-soft text-caution",
  danger: "border-[rgba(255,107,94,0.4)] bg-danger-soft text-danger",
};

export function Chip({
  children,
  tone = "neutral",
  dot = false,
  icon,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] font-medium uppercase leading-none tracking-label",
        tones[tone],
        className
      )}
    >
      {dot ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
      ) : null}
      {icon}
      {children}
    </span>
  );
}
