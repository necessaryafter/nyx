import { type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const variants = {
  primary: "bg-nyx-text-primary text-nyx-void hover:opacity-90",
  secondary: "border border-nyx-border text-nyx-text-primary hover:bg-nyx-elevated",
  ghost: "text-nyx-text-secondary hover:text-nyx-text-primary",
} as const;

const sizes = {
  sm: "px-4 py-2 text-sm rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-lg",
  lg: "px-6 py-3 text-base rounded-lg",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
