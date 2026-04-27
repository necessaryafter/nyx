import { useRef, useState, useEffect } from "react";
import { Play, Pause, SkipForward, Film } from "lucide-react";
import { cn } from "../../lib/cn";

interface ClipPlayerProps {
  clips: string[];       // presigned URLs
  musicUrl?: string;     // presigned URL for background audio
  transitionDur: number; // crossfade duration in seconds
  zoom?: number;         // scale factor (1.0 = no zoom)
  shake?: number;        // 0–10 intensity
}

export function ClipPlayer({ clips, musicUrl, transitionDur, zoom = 1, shake = 0 }: ClipPlayerProps) {
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const videoRefs = [videoA, videoB] as const;

  const [activeBuffer, setActiveBuffer] = useState<0 | 1>(0);
  const [clipIndex, setClipIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Keep a mutable ref so event handlers always see the latest values
  const stateRef = useRef({ activeBuffer: 0 as 0 | 1, clipIndex: 0, playing: false, clips });
  stateRef.current = { activeBuffer, clipIndex, playing, clips };

  // Load first clip when clips change
  useEffect(() => {
    if (clips.length === 0) return;
    const va = videoA.current;
    const vb = videoB.current;
    if (!va || !vb) return;
    va.src = clips[0]!;
    vb.src = "";
    setActiveBuffer(0);
    setClipIndex(0);
    setPlaying(false);
  }, [clips]);

  const advance = (fromBuffer: 0 | 1) => {
    const { clips: c, clipIndex: ci, playing: p } = stateRef.current;
    if (c.length === 0) return;
    const nextIdx = (ci + 1) % c.length;
    const inactiveIdx = (1 - fromBuffer) as 0 | 1;
    const inactiveVideo = videoRefs[inactiveIdx].current;
    if (!inactiveVideo) return;
    inactiveVideo.src = c[nextIdx]!;
    if (p) inactiveVideo.play().catch(() => {});
    setClipIndex(nextIdx);
    setActiveBuffer(inactiveIdx);
  };

  const togglePlay = () => {
    const active = videoRefs[activeBuffer].current;
    if (!active) return;
    if (playing) {
      active.pause();
      musicRef.current?.pause();
    } else {
      active.play().catch(() => {});
      if (musicUrl) musicRef.current?.play().catch(() => {});
    }
    setPlaying((p) => !p);
  };

  const goNext = () => {
    videoRefs[activeBuffer].current?.pause();
    advance(activeBuffer);
  };

  const shakePx = shake * 0.5;
  const hasShake = shake > 0;

  const effectStyle: React.CSSProperties = hasShake
    ? ({ "--clip-zoom": zoom, "--clip-shake-px": `${shakePx}px` } as React.CSSProperties)
    : { transform: `scale(${zoom})` };

  if (clips.length === 0) {
    return (
      <div className="aspect-[9/16] h-full max-h-[calc(100vh-130px)] bg-nyx-surface rounded-xl flex flex-col items-center justify-center gap-3">
        <Film className="h-10 w-10 text-nyx-text-muted opacity-30" />
        <p className="text-xs text-nyx-text-muted">Sem vídeos no template</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="aspect-[9/16] h-full max-h-[calc(100vh-130px)] bg-black rounded-xl overflow-hidden relative select-none">
        {/* Video layers */}
        <div
          className={cn("absolute inset-0", hasShake && "animate-clip-shake")}
          style={effectStyle}
        >
          {([0, 1] as const).map((idx) => (
            <video
              key={idx}
              ref={videoRefs[idx]}
              muted
              playsInline
              onEnded={() => advance(idx)}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: activeBuffer === idx ? 1 : 0,
                transition: `opacity ${transitionDur}s ease-in-out`,
                zIndex: activeBuffer === idx ? 1 : 0,
              }}
            />
          ))}
        </div>

        {musicUrl && <audio ref={musicRef} src={musicUrl} loop />}

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-6 flex items-center gap-2 z-10">
          <button onClick={togglePlay} className="text-white hover:text-nyx-cyan-400 transition-colors shrink-0">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>

          {/* Clip progress dots */}
          <div className="flex flex-1 gap-0.5 overflow-hidden">
            {clips.slice(0, 30).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-300",
                  i === clipIndex ? "bg-nyx-cyan-400" : "bg-white/30",
                )}
              />
            ))}
            {clips.length > 30 && (
              <span className="text-[9px] text-white/50 shrink-0 pl-1">+{clips.length - 30}</span>
            )}
          </div>

          <button onClick={goNext} className="text-white hover:text-nyx-cyan-400 transition-colors shrink-0">
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
