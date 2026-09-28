// Funções puras do Job Scheduler — sem React, fáceis de testar com bun:test direto.

export type CadenceKind = "manual" | "daily" | "weekly" | "custom";

export interface CadenceValue {
  kind: CadenceKind;
  time?: string; // "HH:mm" — daily/weekly
  weekday?: number; // 0=domingo..6=sábado — weekly
  cron?: string; // custom
}

export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Converte a escolha da UI (preset ou cron cru) na expressão cron que a API espera. null = só manual. */
export function cadenceToCron(value: CadenceValue): string | null {
  if (value.kind === "manual") return null;
  if (value.kind === "custom") return value.cron?.trim() || null;

  const [hh, mm] = (value.time ?? "09:00").split(":");
  if (value.kind === "daily") return `${Number(mm)} ${Number(hh)} * * *`;
  return `${Number(mm)} ${Number(hh)} * * ${value.weekday ?? 1}`; // weekly
}

/** Inverso de cadenceToCron — usado ao carregar um scheduler existente no formulário. */
export function cronToCadence(cron: string | null): CadenceValue {
  if (!cron) return { kind: "manual" };
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return { kind: "custom", cron };

  const [mm, hh, dom, mon, dow] = parts;
  if (mon !== "*" || !/^\d+$/.test(mm!) || !/^\d+$/.test(hh!)) return { kind: "custom", cron };
  const time = `${hh!.padStart(2, "0")}:${mm!.padStart(2, "0")}`;

  if (dom === "*" && dow === "*") return { kind: "daily", time };
  if (dom === "*" && /^\d$/.test(dow!)) return { kind: "weekly", time, weekday: Number(dow) };
  return { kind: "custom", cron };
}

export function cadenceLabel(value: CadenceValue): string {
  if (value.kind === "manual") return "Só manual";
  if (value.kind === "daily") return `Diário às ${value.time}`;
  if (value.kind === "weekly") return `${WEEKDAY_LABELS[value.weekday ?? 1]} às ${value.time}`;
  return `Personalizado${value.cron ? ` (${value.cron})` : ""}`;
}

export function formatSchedulerFormat(s: {
  mode: "single" | "parts";
  totalMinutes: number | null;
  partsCount: number | null;
  minutesPerPart: number | null;
}): string {
  if (s.mode === "single") return `Único · ${s.totalMinutes} min`;
  return `${s.partsCount} partes × ${s.minutesPerPart} min`;
}

/** Prévia do CTA no formulário — mostra como ficaria indo da parte `next - 1` pra `next`, de um total de `total`. */
export function applyCtaPreview(template: string, next = 2, total = 4): string {
  if (!template.trim()) return "";
  const filled = template
    .replaceAll("{next}", String(next))
    .replaceAll("{total}", String(total))
    .replaceAll("{n}", String(next - 1))
    .trim();
  return /[.!?]$/.test(filled) ? filled : `${filled}.`;
}
