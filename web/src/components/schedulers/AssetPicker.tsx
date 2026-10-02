import { useState } from "react";
import { Search, Check } from "lucide-react";
import { cn } from "../../lib/cn";
import { useAssets, fetchAssetIds } from "../../hooks/useAssets";
import { CategoryFilter } from "../assets/CategoryFilter";
import { NO_CATEGORY, type Asset } from "../../lib/types";

const PAGE_SIZE = 100;

/**
 * Seletor de assets do scheduler. Filtra por categoria ("Todas", "Avulsos" ou uma categoria),
 * marca item a item ou "Marcar todos" do filtro atual. A seleção é uma lista de ids e continua
 * valendo ao trocar de categoria, então dá pra juntar vídeos de várias categorias (e/ou avulsos).
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
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const assets = useAssets(page, type, search || undefined, category, PAGE_SIZE);

  const selected = new Set(selectedIds);
  const total = assets.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const scope = category === undefined ? "todos" : category === NO_CATEGORY ? "avulsos" : `"${category}"`;

  function toggle(asset: Asset) {
    onChange(selected.has(asset.id) ? selectedIds.filter((id) => id !== asset.id) : [...selectedIds, asset.id]);
  }

  // Marca/desmarca TUDO do filtro atual (todas as páginas, não só a que está na tela).
  async function setAll(on: boolean) {
    setBusy(true);
    try {
      const ids = await fetchAssetIds(type, search || undefined, category);
      onChange(on ? [...new Set([...selectedIds, ...ids])] : selectedIds.filter((id) => !ids.includes(id)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <CategoryFilter
        type={type}
        value={category}
        onChange={(value) => {
          setCategory(value);
          setPage(0);
        }}
        size="sm"
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-nyx-text-muted" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Buscar asset..."
          className="h-8 w-full rounded-lg border border-nyx-border bg-nyx-void pl-8 pr-2 text-xs text-nyx-text-primary focus:border-nyx-cyan-500 focus:outline-none"
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-nyx-text-muted">
        <span>
          <strong className="text-nyx-text-primary">{selectedIds.length}</strong> selecionado{selectedIds.length === 1 ? "" : "s"} no total
        </span>
        <span className="flex gap-3">
          <button type="button" disabled={busy || total === 0} onClick={() => setAll(true)} className="text-nyx-cyan-500 hover:underline disabled:opacity-40">
            Marcar {scope} ({total})
          </button>
          <button type="button" disabled={busy || total === 0} onClick={() => setAll(false)} className="hover:text-nyx-text-primary hover:underline disabled:opacity-40">
            Desmarcar
          </button>
        </span>
      </div>
      <div className="max-h-44 overflow-y-auto rounded-lg border border-nyx-border bg-nyx-void">
        {assets.isPending && <p className="p-3 text-center text-xs text-nyx-text-muted">Carregando...</p>}
        {!assets.isPending && (assets.data?.data.length ?? 0) === 0 && (
          <p className="p-3 text-center text-xs text-nyx-text-muted">Nenhum asset encontrado</p>
        )}
        {assets.data?.data.map((asset) => {
          const active = selected.has(asset.id);
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
              {category === undefined && asset.category && (
                <span className="shrink-0 truncate text-[10px] text-nyx-text-muted">{asset.category}</span>
              )}
            </button>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-[11px] text-nyx-text-muted">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="hover:text-nyx-text-primary disabled:opacity-40">
            Anterior
          </button>
          <span className="font-mono">{page + 1} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="hover:text-nyx-text-primary disabled:opacity-40">
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
