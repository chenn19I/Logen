"use client";

import React from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProofStamp({
  onClick,
  className,
  label = "Keyless, open proof",
}: {
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-2 rounded border border-[rgba(123,216,143,0.35)] bg-positive-soft px-2.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-label text-positive transition-colors duration-120 hover:border-positive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]",
        className
      )}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-[2px] border border-[rgba(123,216,143,0.6)]">
        <Check className="h-2.5 w-2.5" aria-hidden="true" />
      </span>
      Keyless
      <ChevronRight className="h-3 w-3 opacity-70" aria-hidden="true" />
    </button>
  );
}
