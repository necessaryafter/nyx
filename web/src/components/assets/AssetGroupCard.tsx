import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FolderOpen, ChevronDown } from "lucide-react";
import { AssetCard } from "../../pages/AssetsPage";
import type { Asset } from "../../lib/types";

// Deriva o nome do lote a partir do primeiro asset ("{nome} — parte N" → "{nome}");
// se o usuário renomeou o segmento na revisão e o padrão não bate, cai num nome genérico.
function groupName(assets: Asset[]): string {
  const stripped = assets[0]?.name.replace(/ — parte \d+$/, "");
  return stripped && stripped !== assets[0]?.name ? stripped : "Vídeo importado";
}

export function AssetGroupCard({ assets }: { assets: Asset[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={open ? "col-span-full" : ""}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 overflow-hidden rounded-xl border border-nyx-border bg-nyx-surface p-3 text-left transition-colors hover:border-nyx-hover"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-nyx-cyan-500/10">
          <FolderOpen className="h-5 w-5 text-nyx-cyan-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-nyx-text-primary">{groupName(assets)}</p>
          <p className="text-xs text-nyx-text-muted">{assets.length} vídeos</p>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-nyx-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {assets.map((asset, i) => (
                <AssetCard key={asset.id} asset={asset} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
