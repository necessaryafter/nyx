import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  Search,
  Film,
  Music,
  FileText,
  FolderOpen,
  MoreVertical,
  Trash2,
  Pencil,
  Check,
  X,
  Play,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { cn } from "../lib/cn";
import {
  useAssets,
  useAssetCounts,
  useDeleteAsset,
  useRenameAsset,
  useUploadAsset,
  useAssetUrl,
} from "../hooks/useAssets";
import { usePendingImports, useAssetImportsWebSocket } from "../hooks/useAssetImports";
import { UploadProgress, type UploadEntry } from "../components/assets/UploadProgress";
import { ImportButton } from "../components/assets/ImportButton";
import { AssetGroupCard } from "../components/assets/AssetGroupCard";
import { FallbackChoiceModal } from "../components/assets/FallbackChoiceModal";
import { ImportReviewModal } from "../components/assets/ImportReviewModal";
import { VideoPreviewModal } from "../components/assets/VideoPreviewModal";
import type { Asset } from "../lib/types";

type TypeFilter = "all" | "video" | "audio" | "text";

const ALLOWED_MIME_PREFIXES = ["video/", "audio/"];
const ALLOWED_MIME_EXACT = ["text/plain"];
const ALLOWED_EXTENSIONS = [".mp4", ".webm", ".mp3", ".wav", ".ogg", ".m4a", ".txt"];

function isAllowedFile(file: File): boolean {
  if (ALLOWED_MIME_PREFIXES.some((p) => file.type.startsWith(p))) return true;
  if (ALLOWED_MIME_EXACT.includes(file.type)) return true;
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as const },
});

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

function AssetThumbnail({ asset, onPlay }: { asset: Asset; onPlay?: () => void }) {
  if (asset.type === "video") {
    return (
      <button
        onClick={onPlay}
        className="group/play flex h-full w-full items-center justify-center bg-nyx-deep"
      >
        <Film className="h-10 w-10 text-nyx-cyan-500 opacity-60 transition-opacity group-hover/play:opacity-0" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/play:bg-black/50 group-hover/play:opacity-100">
          <Play className="h-8 w-8 fill-white text-white" />
        </span>
      </button>
    );
  }
  if (asset.type === "audio") {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-nyx-cyan-500/20 to-nyx-orange-500/20">
        <Music className="h-10 w-10 text-nyx-cyan-500 opacity-60" />
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center bg-nyx-elevated">
      <FileText className="h-10 w-10 text-nyx-text-muted opacity-60" />
    </div>
  );
}

function AssetCardMenu({
  asset,
  onDelete,
  onRename,
  onOpenChange,
}: {
  asset: Asset;
  onDelete: () => void;
  onRename: (name: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState(asset.name);

  if (renaming) {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRename(nameValue);
              setRenaming(false);
            }
            if (e.key === "Escape") setRenaming(false);
          }}
          className="h-7 w-full rounded border border-nyx-cyan-500 bg-nyx-deep px-2 text-xs text-nyx-text-primary focus:outline-none"
        />
        <button
          onClick={() => {
            onRename(nameValue);
            setRenaming(false);
          }}
          className="text-nyx-cyan-500 hover:opacity-80"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={() => setRenaming(false)}
          className="text-nyx-text-muted hover:opacity-80"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="rounded p-1 text-nyx-text-muted transition-colors hover:bg-nyx-hover hover:text-nyx-text-primary"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-7 z-20 min-w-[130px] overflow-hidden rounded-lg border border-nyx-border bg-nyx-surface shadow-xl"
          >
            <button
              onClick={() => {
                setOpen(false);
                setRenaming(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-nyx-text-secondary hover:bg-nyx-hover hover:text-nyx-text-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
              Renomear
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Deletar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AssetCard({
  asset,
  index,
}: {
  asset: Asset;
  index: number;
}) {
  const deleteAsset = useDeleteAsset();
  const renameAsset = useRenameAsset();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [watching, setWatching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const assetUrl = useAssetUrl(asset.id, watching);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative rounded-xl border border-nyx-border bg-nyx-surface transition-all duration-150 hover:border-nyx-hover hover:shadow-lg",
        // O dropdown do "..." abre pra fora do card (de propósito, senão "Deletar" fica
        // cortado) — sem isso ele fica escondido atrás do próximo card da grade (mesmo
        // stacking context por causa do transform do motion.div), e um clique que parece
        // ir em "Renomear" pode acabar caindo no card de baixo. z-10 levanta o card inteiro
        // (dropdown incluso) só enquanto o menu estiver aberto.
        menuOpen && "z-10",
      )}
    >
      {/* Thumbnail — overflow-hidden só aqui (não no card inteiro), senão corta o
          dropdown do menu "..." que abre pra baixo (Renomear aparecia, Deletar não).
          "relative" aqui (não só no wrapper externo) pro overlay de confirmar exclusão
          funcionar também dentro de AssetGroupCard, que não tem esse wrapper. */}
      <div className="relative aspect-square w-full overflow-hidden rounded-t-xl">
        <AssetThumbnail asset={asset} onPlay={() => setWatching(true)} />
      </div>

      {watching && (
        <VideoPreviewModal url={assetUrl.data?.url} name={asset.name} onClose={() => setWatching(false)} />
      )}

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-medium text-nyx-text-primary"
              title={asset.name}
            >
              {asset.name}
            </p>
            <p className="mt-0.5 text-xs text-nyx-text-muted">
              {asset.type === "video" ? "Vídeo" : asset.type === "audio" ? "Áudio" : "Texto"}{" "}
              · {formatBytes(asset.sizeBytes)}
            </p>
            <p className="text-xs text-nyx-text-muted">{timeAgo(asset.createdAt)}</p>
          </div>
          <AssetCardMenu
            asset={asset}
            onDelete={() => setConfirmDelete(true)}
            onRename={(name) => renameAsset.mutate({ id: asset.id, name })}
            onOpenChange={setMenuOpen}
          />
        </div>
      </div>

      {/* Delete confirmation overlay */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-nyx-deep/95 p-4 backdrop-blur-sm"
          >
            <p className="text-center text-sm text-nyx-text-primary">
              Deletar <strong>"{asset.name}"</strong>?
            </p>
            <p className="text-center text-xs text-nyx-text-muted">
              Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="!bg-red-600 hover:!bg-red-700"
                onClick={() => {
                  deleteAsset.mutate(asset.id);
                  setConfirmDelete(false);
                }}
              >
                Deletar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 transition-all duration-200",
        dragging
          ? "border-nyx-cyan-500 bg-nyx-cyan-500/5 shadow-[0_0_30px_rgba(6,182,212,0.1)]"
          : "border-nyx-border bg-nyx-surface hover:border-nyx-hover",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,text/plain,.mp4,.webm,.mp3,.wav,.ogg,.m4a,.txt"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
        }}
      />
      <Upload
        className={cn(
          "h-10 w-10 transition-colors",
          dragging ? "text-nyx-cyan-500" : "text-nyx-text-muted",
        )}
      />
      <div className="text-center">
        <p className="text-sm font-medium text-nyx-text-primary">
          Arraste arquivos aqui ou clique para selecionar
        </p>
        <p className="mt-1 text-xs text-nyx-text-muted">
          Formatos: .mp4, .webm, .mp3, .wav, .txt · Máx. 500MB por arquivo
        </p>
      </div>
    </div>
  );
}

type GridItem = { kind: "asset"; asset: Asset } | { kind: "group"; batchId: string; assets: Asset[] };

// Agrupa assets consecutivos do mesmo lote de import — se a paginação cortar
// um lote ao meio, cada página trata o pedaço que recebeu como grupo à parte
// (limitação de v1, aceita pela spec).
function groupAssets(list: Asset[]): GridItem[] {
  const items: GridItem[] = [];
  for (const asset of list) {
    const last = items[items.length - 1];
    if (asset.importBatchId && last?.kind === "group" && last.batchId === asset.importBatchId) {
      last.assets.push(asset);
    } else if (asset.importBatchId) {
      items.push({ kind: "group", batchId: asset.importBatchId, assets: [asset] });
    } else {
      items.push({ kind: "asset", asset });
    }
  }
  return items;
}

const TYPE_TABS: { label: string; value: TypeFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "Vídeos", value: "video" },
  { label: "Áudios", value: "audio" },
  { label: "Textos", value: "text" },
];

export function AssetsPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const currentUploadIdxRef = useRef<number>(-1);

  const uploadAsset = useUploadAsset((pct) => {
    setUploads((prev) =>
      prev.map((u, idx) => idx === currentUploadIdxRef.current ? { ...u, progress: pct } : u),
    );
  });
  const counts = useAssetCounts();
  const assets = useAssets(
    page,
    typeFilter === "all" ? undefined : typeFilter,
    debouncedSearch || undefined,
  );

  useAssetImportsWebSocket();
  const pendingImports = usePendingImports().data?.data ?? [];
  const detectingBatch = pendingImports.find((b) => b.status === "detecting");
  const fallbackBatch = pendingImports.find((b) => b.status === "awaiting_fallback_choice");
  const reviewBatch = pendingImports.find((b) => b.status === "awaiting_review");
  // Cortes já prontos num lote que ainda processa (ou que falhou no meio) — só aparece
  // um botão manual pra espiar/salvar, não abre sozinho (o usuário pediu pra ser assim).
  const partialBatch = pendingImports.find(
    (b) => (b.status === "detecting" || b.status === "failed") && b.segments.length > 0,
  );

  const [openReviewId, setOpenReviewId] = useState<string | null>(null);
  const autoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    if (reviewBatch && autoOpenedRef.current !== reviewBatch.id) {
      autoOpenedRef.current = reviewBatch.id;
      setOpenReviewId(reviewBatch.id);
    }
  }, [reviewBatch?.id]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(
      () => setDebouncedSearch(value),
      300,
    );
  };

  const handleFiles = useCallback(
    async (files: File[]) => {
      const rejected = files.filter((f) => !isAllowedFile(f));
      const allowed = files.filter(isAllowedFile);

      const rejectedEntries: UploadEntry[] = rejected.map((f) => ({
        file: f.name,
        done: false,
        error: "Tipo de arquivo não suportado",
        progress: 0,
      }));

      if (!allowed.length && rejected.length) {
        setUploads((prev) => [...prev, ...rejectedEntries]);
        setTimeout(() => setUploads((prev) => prev.filter((u) => !u.error)), 4000);
        return;
      }

      const entries = [
        ...rejectedEntries,
        ...allowed.map((f): UploadEntry => ({ file: f.name, done: false, progress: 0 })),
      ];
      setUploads((prev) => [...prev, ...entries]);

      const uploadOffset = uploads.length + rejectedEntries.length;
      for (let i = 0; i < allowed.length; i++) {
        const globalIdx = uploadOffset + i;
        currentUploadIdxRef.current = globalIdx;
        try {
          await uploadAsset.mutateAsync(allowed[i]!);
          setUploads((prev) =>
            prev.map((u, idx) => (idx === globalIdx ? { ...u, done: true } : u)),
          );
        } catch (err) {
          setUploads((prev) =>
            prev.map((u, idx) =>
              idx === globalIdx
                ? { ...u, error: err instanceof Error ? err.message : "Erro" }
                : u,
            ),
          );
        }
      }

      // Clear done uploads after 3s
      setTimeout(
        () => setUploads((prev) => prev.filter((u) => !u.done)),
        3000,
      );
    },
    [uploadAsset, uploads.length],
  );

  const total = assets.data?.total ?? 0;
  const limit = 20;
  const totalPages = Math.ceil(total / limit);
  const hasData = (assets.data?.data.length ?? 0) > 0;
  const isEmpty = !assets.isPending && !hasData;

  return (
    <div className="space-y-6">
      {fallbackBatch && <FallbackChoiceModal batchId={fallbackBatch.id} sourceName={fallbackBatch.sourceName} />}
      {openReviewId && <ImportReviewModal batchId={openReviewId} onClose={() => setOpenReviewId(null)} />}

      {/* Header */}
      <motion.div
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        {...fade(0)}
      >
        <h1 className="font-display text-xl font-bold text-nyx-text-primary">
          Assets
        </h1>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nyx-text-muted" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 w-48 rounded-lg border border-nyx-border bg-nyx-surface pl-9 pr-3 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
            />
          </div>

          {/* Upload button */}
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              accept="video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,text/plain,.mp4,.webm,.mp3,.wav,.ogg,.m4a,.txt"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) handleFiles(files);
              }}
            />
            <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-nyx-text-primary px-4 py-2 text-sm font-medium text-nyx-void transition-colors hover:opacity-90">
              <Upload className="h-4 w-4" />
              Upload
            </span>
          </label>

          <ImportButton />
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        className="flex gap-1 border-b border-nyx-border"
        {...fade(0.05)}
      >
        {TYPE_TABS.map((tab) => {
          const count = counts.data?.[tab.value];
          const active = typeFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => {
                setTypeFilter(tab.value);
                setPage(0);
              }}
              className={cn(
                "relative px-4 py-2.5 text-sm transition-colors duration-150",
                active
                  ? "text-nyx-text-primary"
                  : "text-nyx-text-secondary hover:text-nyx-text-primary",
              )}
            >
              {tab.label}
              {count !== undefined && (
                <span className="ml-1.5 text-xs text-nyx-text-muted">
                  ({count})
                </span>
              )}
              {active && (
                <motion.span
                  layoutId="assets-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-nyx-cyan-500"
                />
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Upload progress */}
      <UploadProgress uploads={uploads} />

      {/* Lote em análise — não trava o resto da grid */}
      {detectingBatch && (
        <div className="flex items-center gap-3 rounded-xl border border-nyx-border bg-nyx-surface p-3">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-nyx-border border-t-nyx-cyan-500" />
          <p className="text-sm text-nyx-text-secondary">
            Processando <strong className="text-nyx-text-primary">{detectingBatch.sourceName}</strong>...{" "}
            {partialBatch?.id === detectingBatch.id
              ? "novos cortes prontos aparecem aqui assim que terminam."
              : "detectando/cortando — pode levar alguns minutos em vídeos longos."}
          </p>
          {partialBatch?.id === detectingBatch.id && (
            <button
              onClick={() => setOpenReviewId(detectingBatch.id)}
              className="ml-auto shrink-0 text-xs text-nyx-cyan-500 hover:underline"
            >
              Ver progresso ({partialBatch.segments.length} pronto{partialBatch.segments.length > 1 ? "s" : ""})
            </button>
          )}
        </div>
      )}

      {/* Lote que falhou no meio, mas deixou cortes prontos pra salvar */}
      {!detectingBatch && partialBatch && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm text-nyx-text-secondary">
            O corte de <strong className="text-nyx-text-primary">{partialBatch.sourceName}</strong> falhou, mas{" "}
            {partialBatch.segments.length} pedaço{partialBatch.segments.length > 1 ? "s" : ""} já {partialBatch.segments.length > 1 ? "estão" : "está"} pronto{partialBatch.segments.length > 1 ? "s" : ""}.
          </p>
          <button
            onClick={() => setOpenReviewId(partialBatch.id)}
            className="ml-auto shrink-0 text-xs text-nyx-cyan-500 hover:underline"
          >
            Ver e salvar
          </button>
        </div>
      )}

      {/* Grid / Empty / Skeleton */}
      {assets.isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-nyx-border bg-nyx-surface">
              <Skeleton className="aspect-square w-full" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <motion.div
          className="flex flex-col items-center justify-center gap-4 py-20 text-center"
          {...fade(0.1)}
        >
          <FolderOpen className="h-16 w-16 text-nyx-text-muted opacity-40" />
          <div>
            <p className="text-lg font-medium text-nyx-text-primary">
              {search || typeFilter !== "all"
                ? "Nenhum asset encontrado"
                : "Nenhum asset ainda"}
            </p>
            <p className="mt-1 text-sm text-nyx-text-muted">
              {search || typeFilter !== "all"
                ? `Nenhum ${typeFilter !== "all" ? typeFilter : "asset"} encontrado para "${search || typeFilter}"`
                : "Faça upload de vídeos, áudios e textos para usar nos seus templates"}
            </p>
          </div>
          {search || typeFilter !== "all" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch("");
                setDebouncedSearch("");
                setTypeFilter("all");
              }}
            >
              Limpar filtros
            </Button>
          ) : (
            <DropZone onFiles={handleFiles} />
          )}
        </motion.div>
      ) : (
        <>
          {/* Drop overlay when has data */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {groupAssets(assets.data!.data).map((item, i) =>
              item.kind === "group" ? (
                <AssetGroupCard key={item.batchId} assets={item.assets} />
              ) : (
                <div key={item.asset.id} className="relative">
                  <AssetCard asset={item.asset} index={i} />
                </div>
              ),
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <motion.div
              className="flex items-center justify-center gap-4"
              {...fade(0.1)}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Anterior
              </Button>
              <span className="font-mono text-xs text-nyx-text-muted">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Próxima
              </Button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
