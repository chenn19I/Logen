import React from "react";
import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
  as: Tag = "div",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("panel", className)} {...props}>
      {children}
    </Tag>
  );
}

export function PanelHeader({
  label,
  title,
  action,
  className,
}: {
  label?: React.ReactNode;
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3",
        className
      )}
    >
      <div className="min-w-0">
        {label ? <div className="mono-label">{label}</div> : null}
        {title ? <div className="mt-1 text-16 font-medium text-paper">{title}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
