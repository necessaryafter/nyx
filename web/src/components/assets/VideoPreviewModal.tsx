import { X, Loader2 } from "lucide-react";

interface Props {
  url?: string;
  name: string;
  onClose: () => void;
}

export function VideoPreviewModal({ url, name, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 rounded-lg p-1.5 text-white/80 transition-colors hover:text-white"
        >
          <X className="h-6 w-6" />
        </button>
        {url ? (
          <video src={url} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-xl bg-black" />
        ) : (
          <div className="flex aspect-[9/16] w-72 items-center justify-center rounded-xl bg-nyx-surface">
            <Loader2 className="h-6 w-6 animate-spin text-nyx-text-muted" />
          </div>
        )}
        <p className="mt-2 truncate text-center text-xs text-white/70">{name}</p>
      </div>
    </div>
  );
}
