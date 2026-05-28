import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

const variants = {
  default: "border-nyx-line    bg-nyx-raised  text-nyx-2",
  teal:    "border-nyx-teal/20 bg-nyx-teal/8  text-nyx-teal",
  amber:   "border-nyx-amber/20 bg-nyx-amber/8 text-nyx-amber",
  red:     "border-nyx-red/20  bg-nyx-red/8   text-nyx-red",
  green:   "border-nyx-green/20 bg-nyx-green/8 text-nyx-green",
} as const;

type BadgeProps = {
  children: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-px",
        "text-[10px] font-display font-semibold tracking-widest uppercase",
        "rounded-[2px] border",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
