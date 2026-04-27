import { cn } from "../../lib/cn";

const CHECKS = [
  { test: (p: string) => p.length >= 8, label: "8+ caracteres" },
  { test: (p: string) => /\d/.test(p), label: "Número" },
  { test: (p: string) => /[A-Z]/.test(p), label: "Maiúscula" },
  { test: (p: string) => /[^a-zA-Z0-9]/.test(p), label: "Especial" },
];

const LABELS = ["Fraca", "Fraca", "Média", "Boa", "Forte"];

function getColor(score: number) {
  if (score <= 1) return "bg-nyx-error";
  if (score === 2) return "bg-nyx-orange-400";
  return "bg-nyx-success";
}

function getLabelColor(score: number) {
  if (score <= 1) return "text-nyx-error";
  if (score === 2) return "text-nyx-orange-400";
  return "text-nyx-success";
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const score = CHECKS.filter((c) => c.test(password)).length;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-150",
              i < score ? getColor(score) : "bg-nyx-border",
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs transition-colors", getLabelColor(score))}>
        {LABELS[score]}
      </p>
    </div>
  );
}
