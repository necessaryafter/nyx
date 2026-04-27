import { type InputHTMLAttributes, useState, useId } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, type, className, ...props }: InputProps) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-nyx-text-secondary"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && showPassword ? "text" : type}
          className={cn(
            "w-full rounded-lg border border-nyx-border bg-nyx-deep px-4 py-3 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted",
            "transition-all duration-150",
            "focus:border-nyx-cyan-500 focus:outline-none focus:ring-[3px] focus:ring-nyx-cyan-500/20",
            error &&
              "border-nyx-error focus:border-nyx-error focus:ring-nyx-error/20",
            isPassword && "pr-11",
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-nyx-text-muted transition-colors hover:text-nyx-text-secondary"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-nyx-error">{error}</p>}
    </div>
  );
}
