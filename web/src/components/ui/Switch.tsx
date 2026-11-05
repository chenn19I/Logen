"use client";

import React from "react";
import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-5 w-9 shrink-0 rounded border border-line bg-surface-sunken transition-colors duration-120 data-[state=checked]:border-signal data-[state=checked]:bg-signal-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
      >
        <RadixSwitch.Thumb className="block h-3 w-3 translate-x-1 rounded-[2px] bg-paper-muted transition-transform duration-120 ease-calm data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-signal" />
      </RadixSwitch.Root>
      <label
        htmlFor={id}
        className="cursor-pointer font-mono text-12 uppercase tracking-label text-paper-muted"
      >
        {label}
      </label>
    </div>
  );
}
