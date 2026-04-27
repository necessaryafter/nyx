import { AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface ErrorBannerProps {
  message: string | null;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function ErrorBanner({ message, action }: ErrorBannerProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-3 rounded-lg border border-nyx-error/20 bg-nyx-error/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-nyx-error" />
            <div className="flex flex-col gap-1">
              <p className="text-sm text-nyx-error">{message}</p>
              {action && (
                <button
                  onClick={action.onClick}
                  className="cursor-pointer text-left text-sm text-nyx-cyan-500 hover:underline"
                >
                  {action.label}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
