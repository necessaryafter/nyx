import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type BadgeProps = {
  children: ReactNode;
  className?: string;
};

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-nyx-border bg-nyx-surface px-3 py-1 text-xs font-medium text-nyx-text-secondary",
        className,
      )}
    >
      {children}
    </span>
  );
}
