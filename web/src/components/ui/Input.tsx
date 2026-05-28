import { type InputHTMLAttributes, useState, useId, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, type, className, prefix, suffix, ...props }, ref) => {
    const id = useId();
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="label">
            {label}
          </label>
        )}
        <div
          className={cn(
            "flex items-center gap-2 h-8 px-3",
            "bg-nyx-base border border-nyx-line rounded-[3px]",
            "transition-colors duration-150",
            "focus-within:border-nyx-line-hi",
            error && "border-nyx-red/50 focus-within:border-nyx-red/70",
          )}
        >
          {prefix && (
            <span className="text-nyx-3 shrink-0 flex items-center">{prefix}</span>
          )}
          <input
            ref={ref}
            id={id}
            type={isPassword && showPassword ? "text" : type}
            className={cn(
              "flex-1 min-w-0 bg-transparent text-sm text-nyx-1",
              "placeholder:text-nyx-3 font-body",
              "outline-none border-none",
              isPassword && "pr-2",
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="text-nyx-3 shrink-0 flex items-center">{suffix}</span>
          )}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="text-nyx-3 hover:text-nyx-2 transition-colors shrink-0"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-nyx-red">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
