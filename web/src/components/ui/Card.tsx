import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type CardProps = {
  children: ReactNode;
  className?: string;
  padding?: boolean;
  interactive?: boolean;
};

export function Card({ children, className, padding = true, interactive = false }: CardProps) {
  return (
    <div
      className={cn(
        "nyx-panel",
        padding && "p-4",
        interactive && "transition-colors duration-150 cursor-pointer hover:border-nyx-line-hi hover:bg-nyx-overlay",
        className,
      )}
    >
      {children}
    </div>
  );
}
