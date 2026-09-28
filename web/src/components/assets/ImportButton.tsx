import { useRef, useState } from "react";
import { FolderInput } from "lucide-react";
import { useStartImport } from "../../hooks/useAssetImports";
import { UploadProgress, type UploadEntry } from "./UploadProgress";

// Botão "Importar vídeo longo" — sobe em chunks e some, o resto do fluxo
// (processando → fallback → revisão) é conduzido pelo status do lote,
// acompanhado via usePendingImports em AssetsPage.
export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<UploadEntry | null>(null);
  const startImport = useStartImport((pct) => setUpload((u) => (u ? { ...u, progress: pct } : u)));

  const handleFile = async (file: File) => {
    setUpload({ file: file.name, done: false, progress: 0 });
    try {
      await startImport.mutateAsync(file);
      setUpload((u) => (u ? { ...u, done: true } : u));
      setTimeout(() => setUpload(null), 3000);
    } catch (err) {
      setUpload((u) => (u ? { ...u, error: err instanceof Error ? err.message : "Erro" } : u));
      setTimeout(() => setUpload(null), 4000);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="cursor-pointer">
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,.mp4,.webm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleFile(file);
          }}
        />
        <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-nyx-border px-4 py-2 text-sm font-medium text-nyx-text-primary transition-colors hover:bg-nyx-elevated">
          <FolderInput className="h-4 w-4" />
          Importar vídeo longo
        </span>
      </label>
      {upload && <UploadProgress uploads={[upload]} />}
    </div>
  );
}
