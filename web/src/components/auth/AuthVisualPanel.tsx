import { motion } from "motion/react";

export function AuthVisualPanel() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-nyx-void">
      {/* Gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(249, 115, 22, 0.05))",
        }}
      />

      {/* Dot grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--nyx-grid-dot) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 80%)",
        }}
      />

      {/* Ambient glow */}
      <motion.div
        className="pointer-events-none absolute"
        style={{
          width: "clamp(300px, 40vw, 500px)",
          height: "clamp(300px, 40vw, 500px)",
          background:
            "radial-gradient(circle, var(--nyx-cyan-400) 0%, transparent 70%)",
          opacity: 0.06,
          filter: "blur(80px)",
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.06, 0.09, 0.06],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
        <span className="font-logo text-4xl tracking-[0.2em] text-nyx-text-primary">
          NYX
        </span>
        <p className="max-w-xs text-lg text-nyx-text-secondary">
          Configure once. Produce forever.
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="font-display font-semibold text-nyx-cyan-500">
            12,847
          </span>
          <span className="text-nyx-text-muted">videos renderizados</span>
        </div>
      </div>
    </div>
  );
}
