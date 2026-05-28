import { forwardRef } from "react";
import { cn } from "../../lib/cn";

const variants = {
  primary:   "bg-nyx-teal text-nyx-void hover:opacity-90 active:opacity-80",
  secondary: "border border-nyx-line-hi text-nyx-1 hover:bg-nyx-raised hover:border-nyx-2/40",
  ghost:     "text-nyx-2 hover:text-nyx-1 hover:bg-nyx-hover",
  white:     "bg-nyx-1 text-nyx-void hover:bg-[#d8d8d8] active:bg-[#c2c2c2]",
  danger:    "border border-nyx-red/30 text-nyx-red bg-nyx-red/5 hover:bg-nyx-red/10",
} as const;

const sizes = {
  xs: "h-6  px-2.5 text-[10px] gap-1",
  sm: "h-7  px-3   text-[11px] gap-1.5",
  md: "h-8  px-4   text-xs     gap-1.5",
  lg: "h-9  px-5   text-sm     gap-2",
  xl: "h-10 px-6   text-sm     gap-2",
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center font-display font-semibold tracking-wider uppercase",
        "rounded-[3px] transition-all duration-150 cursor-pointer select-none",
        "disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

Button.displayName = "Button";
