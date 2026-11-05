"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "bottom";
  trigger?: React.ReactNode;
  className?: string;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
  trigger,
  className,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-[var(--overlay)]" />
        <Dialog.Content
          data-side={side}
          className={cn(
            "sheet-content fixed z-50 flex flex-col border-line bg-surface text-paper sheet-shadow",
            side === "right"
              ? "inset-y-0 right-0 w-full max-w-[460px] border-l"
              : "inset-x-0 bottom-0 max-h-[90dvh] w-full border-t sm:left-1/2 sm:right-auto sm:w-[560px] sm:-translate-x-1/2",
            className
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-24 font-semibold text-paper">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-14 leading-relaxed text-paper-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-transparent text-paper-muted transition-colors hover:border-line hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer ? (
            <div className="border-t border-line px-5 py-4">{footer}</div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
