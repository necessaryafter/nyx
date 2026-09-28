import { cn } from "../../lib/cn";
import { WEEKDAY_LABELS, type CadenceValue } from "../../lib/scheduler";

const inputCls =
  "h-9 rounded-lg border border-nyx-border bg-nyx-void px-2.5 text-sm text-nyx-text-primary focus:border-nyx-cyan-500 focus:outline-none";

const PRESETS: Array<{ kind: CadenceValue["kind"]; label: string }> = [
  { kind: "manual", label: "Só manual" },
  { kind: "daily", label: "Diário" },
  { kind: "weekly", label: "Semanal" },
  { kind: "custom", label: "Personalizado (cron)" },
];

export function CadencePicker({ value, onChange }: { value: CadenceValue; onChange: (v: CadenceValue) => void }) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.kind}
            type="button"
            onClick={() => onChange(p.kind === "daily" || p.kind === "weekly" ? { kind: p.kind, time: "09:00", weekday: 1 } : { kind: p.kind })}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              value.kind === p.kind
                ? "border-nyx-cyan-500 bg-nyx-cyan-500/10 text-nyx-cyan-400"
                : "border-nyx-border text-nyx-text-secondary hover:bg-nyx-hover",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {(value.kind === "daily" || value.kind === "weekly") && (
        <div className="flex items-center gap-2">
          {value.kind === "weekly" && (
            <select
              value={value.weekday ?? 1}
              onChange={(e) => onChange({ ...value, weekday: Number(e.target.value) })}
              className={inputCls}
            >
              {WEEKDAY_LABELS.map((label, i) => (
                <option key={i} value={i}>{label}</option>
              ))}
            </select>
          )}
          <input
            type="time"
            value={value.time ?? "09:00"}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
            className={inputCls}
          />
        </div>
      )}

      {value.kind === "custom" && (
        <input
          value={value.cron ?? ""}
          onChange={(e) => onChange({ ...value, cron: e.target.value })}
          placeholder="*/30 * * * *"
          className={cn(inputCls, "w-full font-mono")}
        />
      )}

      <p className="text-xs text-nyx-text-muted">Fuso: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
    </div>
  );
}
