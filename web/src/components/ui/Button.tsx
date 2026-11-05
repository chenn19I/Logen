import React, { forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded border font-medium transition-colors duration-120 ease-calm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-45 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  primary:
    "border-signal bg-signal text-[#08111c] hover:bg-[var(--accent-strong)] active:bg-signal",
  secondary:
    "border-line bg-transparent text-paper hover:border-line-strong hover:bg-[var(--surface-raised)]",
  ghost:
    "border-transparent bg-transparent text-paper-dim hover:bg-[var(--surface-raised)] hover:text-paper",
  danger:
    "border-danger bg-danger-soft text-danger hover:bg-[rgba(255,107,94,0.18)]",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-12",
  md: "min-h-11 px-4 text-14",
  lg: "min-h-12 px-5 text-14",
};

export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string
): string {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={buttonClasses(variant, size, cn(fullWidth && "w-full", className))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {children}
      </button>
    );
  }
);

export interface LinkButtonProps
  extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={buttonClasses(variant, size, cn(fullWidth && "w-full", className))}
      {...props}
    >
      {children}
    </Link>
  );
}
