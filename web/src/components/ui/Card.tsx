import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-nyx-border bg-nyx-surface p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
