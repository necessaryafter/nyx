import { cn } from "../../lib/cn";
import { applyCtaPreview } from "../../lib/scheduler";

const CHIPS = ["{next}", "{n}", "{total}"];

export function CtaInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-nyx-text-secondary">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-nyx-border bg-nyx-void px-2.5 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onChange(`${value}${chip}`)}
            className={cn(
              "rounded-md border border-nyx-border px-1.5 py-0.5 font-mono text-[10px] text-nyx-text-muted",
              "hover:border-nyx-cyan-500 hover:text-nyx-cyan-400",
            )}
          >
            {chip}
          </button>
        ))}
      </div>
      {value.trim() && (
        <p className="text-xs text-nyx-text-muted">
          Prévia: <span className="text-nyx-text-secondary">{applyCtaPreview(value)}</span>
        </p>
      )}
    </div>
  );
}
