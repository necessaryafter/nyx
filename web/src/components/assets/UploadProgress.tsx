import { Check, X } from "lucide-react";
import { cn } from "../../lib/cn";

export type UploadEntry = { file: string; done: boolean; error?: string; progress: number };

// Extraído de AssetsPage.tsx pra ser reaproveitado pelo import de vídeo longo
// (mesma barra, só muda quem alimenta as entradas).
export function UploadProgress({ uploads }: { uploads: UploadEntry[] }) {
  if (uploads.length === 0) return null;
  return (
    <div className="space-y-1">
      {uploads.map((u, i) => (
        <div
          key={i}
          className="rounded-lg border border-nyx-border bg-nyx-surface px-3 py-2 text-xs"
        >
          <div className="flex items-center gap-2">
            {u.done ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-green-400" />
            ) : u.error ? (
              <X className="h-3.5 w-3.5 shrink-0 text-red-400" />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-nyx-border border-t-nyx-cyan-500" />
            )}
            <span className="min-w-0 flex-1 truncate text-nyx-text-secondary">{u.file}</span>
            {!u.done && !u.error && (
              <span className="shrink-0 tabular-nums text-nyx-text-muted">
                {u.progress === -1 ? "Processando..." : `${u.progress}%`}
              </span>
            )}
            {u.error && (
              <span className="ml-auto shrink-0 text-red-400">{u.error}</span>
            )}
          </div>
          {!u.done && !u.error && (
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-nyx-border">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-150",
                  u.progress === -1 ? "w-full animate-pulse bg-nyx-cyan-500/50" : "bg-nyx-cyan-500",
                )}
                style={u.progress !== -1 ? { width: `${u.progress}%` } : undefined}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
