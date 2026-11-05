"use client";

import React from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const TabsRoot = RadixTabs.Root;
export const TabsContent = RadixTabs.Content;

export function TabsList({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <RadixTabs.List
      aria-label={label}
      className={cn(
        "flex items-center gap-5 overflow-x-auto border-b border-line no-scrollbar",
        className
      )}
    >
      {children}
    </RadixTabs.List>
  );
}

export function TabsTrigger({
  value,
  children,
  count,
}: {
  value: string;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <RadixTabs.Trigger
      value={value}
      className="group relative shrink-0 border-b border-transparent px-0 pb-3 pt-1 font-mono text-12 uppercase tracking-label text-paper-muted transition-colors duration-120 hover:text-paper data-[state=active]:border-signal data-[state=active]:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
    >
      <span className="inline-flex items-center gap-2">
        {children}
        {typeof count === "number" ? (
          <span className="rounded border border-line px-1.5 py-0.5 text-[10px] leading-none text-paper-muted">
            {count}
          </span>
        ) : null}
      </span>
    </RadixTabs.Trigger>
  );
}
