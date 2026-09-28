import { useState } from "react";
import { Search, Check } from "lucide-react";
import { cn } from "../../lib/cn";
import { useAssets } from "../../hooks/useAssets";
import type { Asset } from "../../lib/types";

/**
 * Mesmo padrão visual do AssetPicker que já existe (duplicado) em
 * PropertiesPanel.tsx e Step3_MediaSlots.tsx — versão compartilhada porque
 * aqui é o terceiro lugar que precisa dele.
 */
export function AssetPicker({
  type,
  selectedIds,
  onChange,
}: {
  type: "video" | "audio" | "image";
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const assets = useAssets(0, type, search || undefined);

  function toggle(asset: Asset) {
    onChange(selectedIds.includes(asset.id) ? selectedIds.filter((id) => id !== asset.id) : [...selectedIds, asset.id]);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-nyx-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar asset..."
          className="h-8 w-full rounded-lg border border-nyx-border bg-nyx-void pl-8 pr-2 text-xs text-nyx-text-primary focus:border-nyx-cyan-500 focus:outline-none"
        />
      </div>
      <div className="max-h-44 overflow-y-auto rounded-lg border border-nyx-border bg-nyx-void">
        {assets.isPending && <p className="p-3 text-center text-xs text-nyx-text-muted">Carregando...</p>}
        {!assets.isPending && (assets.data?.data.length ?? 0) === 0 && (
          <p className="p-3 text-center text-xs text-nyx-text-muted">Nenhum asset encontrado</p>
        )}
        {assets.data?.data.map((asset) => {
          const active = selectedIds.includes(asset.id);
          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => toggle(asset)}
              className={cn(
                "flex w-full items-center gap-2 border-b border-nyx-border/60 px-2.5 py-2 text-left last:border-b-0 hover:bg-nyx-hover",
                active && "bg-nyx-cyan-500/10",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  active ? "border-nyx-cyan-500 bg-nyx-cyan-500" : "border-nyx-border",
                )}
              >
                {active && <Check className="h-2.5 w-2.5 text-white" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-nyx-text-secondary">{asset.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
