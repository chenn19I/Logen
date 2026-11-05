import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, prefix, suffix, className, id, ...props },
  ref
) {
  const inputId = id || `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={inputId}
        className="block font-mono text-12 uppercase tracking-label text-paper-muted"
      >
        {label}
      </label>
      <div
        className={cn(
          "flex min-h-11 items-center rounded border bg-surface-sunken px-3 transition-colors focus-within:border-signal",
          error ? "border-danger" : "border-line"
        )}
      >
        {prefix ? (
          <span className="mr-2 font-mono text-14 text-paper-muted" aria-hidden="true">
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : undefined}
          className="w-full bg-transparent py-2.5 font-mono text-14 text-paper outline-none placeholder:text-paper-muted"
          {...props}
        />
        {suffix ? (
          <span className="ml-2 font-mono text-12 text-paper-muted">{suffix}</span>
        ) : null}
      </div>
      {hint && !error ? (
        <p id={hintId} className="text-12 leading-relaxed text-paper-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-12 leading-relaxed text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
