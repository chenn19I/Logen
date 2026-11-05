"use client";

import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, DoorClosed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SeatGlyph } from "./SeatGlyph";

export type HandoffMode = "seller" | "buyer";

export function HandoffOverlay({
  open,
  mode,
  seatNumber,
  amountNear,
  onClose,
  onContinue,
  continueLabel = "Back to wallet",
}: {
  open: boolean;
  mode: HandoffMode;
  seatNumber: string;
  amountNear: string;
  onClose?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
}) {
  const reduced = useReducedMotion();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!open) {
      setSettled(false);
      return;
    }
    const timer = window.setTimeout(() => setSettled(true), reduced ? 120 : 1200);
    return () => window.clearTimeout(timer);
  }, [open, reduced]);

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose?.();
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[60] bg-[var(--overlay)]" />
        <Dialog.Content className="sheet-shadow fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded border border-line bg-surface p-6 text-center">
          <Dialog.Title className="mono-label">Handoff</Dialog.Title>
          <Dialog.Description className="sr-only">
            {mode === "seller"
              ? `Seat ${seatNumber} has been sold. This seat now belongs to someone else.`
              : `Seat ${seatNumber} is yours. ${amountNear} NEAR came with it.`}
          </Dialog.Description>

          <div className="mt-6 flex min-h-[180px] items-center justify-center">
            {mode === "seller" ? (
              <div className="flex flex-col items-center">
                <div className="relative h-28 w-28">
                  <motion.div
                    className="absolute inset-0"
                    animate={{ opacity: settled ? 0 : 1 }}
                    transition={{ duration: reduced ? 0.12 : 0.32 }}
                  >
                    <div className="grid h-28 w-28 grid-cols-5 gap-1.5">
                      {Array.from({ length: 25 }).map((_, index) => (
                        <motion.span
                          key={index}
                          className="block rounded-[1px] bg-paper"
                          initial={{ opacity: 0.9 }}
                          animate={
                            reduced
                              ? { opacity: 0 }
                              : {
                                  opacity: 0,
                                  scale: 0.4,
                                  rotate: index % 2 === 0 ? 12 : -12,
                                }
                          }
                          transition={{
                            duration: reduced ? 0.12 : 0.42,
                            delay: reduced ? 0 : index * 0.014,
                            ease: [0.2, 0.8, 0.2, 1],
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: settled ? 1 : 0, scale: settled ? 1 : 0.92 }}
                    transition={{ duration: reduced ? 0.12 : 0.32, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    <span className="inline-flex h-20 w-20 items-center justify-center rounded border border-line bg-surface-sunken text-paper-muted">
                      <DoorClosed className="h-8 w-8" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                  </motion.div>
                </div>
                <p className="mt-6 max-w-[28ch] text-16 leading-snug text-paper">
                  This seat now belongs to someone else.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <motion.div
                  initial={
                    reduced ? { opacity: 0 } : { y: 24, opacity: 0, scale: 0.96 }
                  }
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: reduced ? 0.12 : 0.42, ease: [0.2, 0.8, 0.2, 1] }}
                  className="w-full max-w-[300px] rounded border border-line bg-surface-sunken p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="bracket-label">[ {seatNumber} / SEAT ]</span>
                    <span className="font-mono text-[10px] uppercase tracking-label text-positive">
                      Yours
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <SeatGlyph
                      tokenId={`s${seatNumber}.handoff`}
                      innerDots={6}
                      size={64}
                      ping={!reduced}
                    />
                    <div className="text-right">
                      <div className="mono-label">Inside</div>
                      <div className="font-mono text-24 tabular text-paper">
                        {amountNear}
                        <span className="ml-1 text-12 text-paper-muted">NEAR</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
                <p className="mt-6 max-w-[30ch] text-16 leading-snug text-paper">
                  Seat {seatNumber} is yours. {amountNear} NEAR came with it.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <Button
              fullWidth
              variant={mode === "buyer" ? "primary" : "secondary"}
              onClick={() => {
                if (onContinue) onContinue();
                else onClose?.();
              }}
              disabled={!settled}
            >
              {settled ? continueLabel : "One moment"}
              {settled ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
            </Button>
            <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
              {mode === "seller" ? "Access ended in 3 seconds" : "Access begins now"}
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
