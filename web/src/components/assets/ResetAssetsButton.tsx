import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { useResetAssets } from "../../hooks/useAssets";

/** Apaga TODOS os assets. Exige digitar RESETAR; o backend também confere. */
export function ResetAssetsButton({ total }: { total: number }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const reset = useResetAssets();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={total === 0}
        className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
        Resetar assets
      </button>
    );
  }

  const done = reset.data;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-nyx-border bg-nyx-surface p-6">
        {done ? (
          <>
            <p className="text-sm text-nyx-text-primary">
              {done.deleted} asset{done.deleted === 1 ? "" : "s"} apagado{done.deleted === 1 ? "" : "s"}.
            </p>
            <p className="text-xs text-nyx-text-muted">
              Referências removidas de {done.schedulersUpdated} scheduler{done.schedulersUpdated === 1 ? "" : "s"} e{" "}
              {done.templatesUpdated} template{done.templatesUpdated === 1 ? "" : "s"}. Escolha os vídeos de novo nos schedulers depois de subir os novos.
            </p>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setOpen(false); setTyped(""); reset.reset(); }}>Fechar</Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-bold text-nyx-text-primary">Resetar todos os assets?</h2>
            <p className="text-sm text-nyx-text-secondary">
              Isso apaga os <strong>{total}</strong> assets (arquivos incluídos) e tira eles dos schedulers e templates. Não dá pra desfazer.
            </p>
            <label className="block space-y-1 text-xs text-nyx-text-muted">
              Digite <strong className="text-nyx-text-primary">RESETAR</strong> pra confirmar
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="h-9 w-full rounded-lg border border-nyx-border bg-nyx-void px-3 text-sm text-nyx-text-primary focus:border-red-500 focus:outline-none"
              />
            </label>
            {reset.isError && <p className="text-xs text-red-400">Falhou. Tente de novo.</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setTyped(""); }}>Cancelar</Button>
              <Button
                size="sm"
                className="!bg-red-600 !text-white hover:!bg-red-700 disabled:opacity-40"
                disabled={typed !== "RESETAR" || reset.isPending}
                onClick={() => reset.mutate()}
              >
                {reset.isPending ? "Apagando..." : "Apagar tudo"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
