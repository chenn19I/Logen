"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { castAsciiSpell } from "@/components/ascii/AsciiSpellEngine";
import { cn } from "@/lib/utils";

/**
 * Calm section entrance on scroll that conjures a subtle ASCII rune shimmer
 * as it materializes into view.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 14,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-72px" }}
      onViewportEnter={(entry) => {
        if (entry?.boundingClientRect && typeof window !== "undefined") {
          const rect = entry.boundingClientRect;
          castAsciiSpell({
            x: rect.left + rect.width * 0.5,
            y: Math.min(window.innerHeight - 60, Math.max(80, rect.top + 40)),
            intensity: 0.65,
            tone: "paper",
          });
        }
      }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
