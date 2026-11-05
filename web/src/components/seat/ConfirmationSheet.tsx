"use client";

import React from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface ConfirmationBlock {
  label: string;
  value: React.ReactNode;
}

export function ConfirmationSheet({
  open,
  onOpenChange,
  title,
  description,
  blocks,
  primaryLabel,
  onConfirm,
  pending = false,
  pendingMessage = "Finishing a payout. This takes a few seconds.",
  error,
  children,
  note,
  confirmDisabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  blocks: ConfirmationBlock[];
  primaryLabel: string;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
  pendingMessage?: string;
  error?: string | null;
  children?: React.ReactNode;
  note?: React.ReactNode;
  confirmDisabled?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      side="bottom"
      footer={
        <div className="space-y-3">
          <Button
            fullWidth
            size="lg"
            onClick={() => void onConfirm()}
            loading={pending}
            disabled={confirmDisabled}
          >
            {primaryLabel}
          </Button>
          {pending ? (
            <p
              className="flex items-center justify-center gap-2 text-center text-12 text-paper-muted"
              role="status"
            >
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {pendingMessage}
            </p>
          ) : null}
          {error ? (
            <p
              className="flex items-start justify-center gap-2 text-center text-12 text-danger"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              That did not go through. Nothing moved.
            </p>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        {children ? <div>{children}</div> : null}
        <dl className="divide-y divide-line border-y border-line">
          {blocks.map((block) => (
            <div
              key={block.label}
              className={cn(
                "grid gap-1 py-3 sm:grid-cols-[160px_1fr] sm:gap-4",
                "first:pt-3 last:pb-3"
              )}
            >
              <dt className="mono-label">{block.label}</dt>
              <dd className="text-14 leading-relaxed text-paper-dim">{block.value}</dd>
            </div>
          ))}
        </dl>
        {note ? <div className="text-12 leading-relaxed text-paper-muted">{note}</div> : null}
      </div>
    </Sheet>
  );
}
