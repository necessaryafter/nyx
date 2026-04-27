import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  loading = false,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            className="relative w-full max-w-sm rounded-xl border border-nyx-border bg-nyx-elevated p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {destructive && (
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-nyx-error/10">
                <AlertTriangle className="h-5 w-5 text-nyx-error" />
              </div>
            )}

            <h3 className="font-display text-base font-semibold text-nyx-text-primary">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-nyx-text-secondary">
              {description}
            </p>

            <div className="mt-6 flex gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                {cancelLabel}
              </Button>
              <button
                ref={confirmRef}
                onClick={onConfirm}
                disabled={loading}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  destructive
                    ? "bg-nyx-error text-white hover:bg-nyx-error/90"
                    : "bg-nyx-cyan-500 text-nyx-void hover:bg-nyx-cyan-400"
                } disabled:opacity-50`}
              >
                {loading ? "..." : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
