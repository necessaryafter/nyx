import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Typewriter } from "../ui/Typewriter";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] as const },
});

const LOGOS = ["Acesso antecipado aberto", "Sem cartão de crédito", "10 créditos grátis"];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Dot grid with vignette fade */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--nyx-grid-dot) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 40%, black 10%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 40%, black 10%, transparent 70%)",
        }}
      />

      {/* Gradient glow blobs */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "clamp(500px, 60vw, 900px)",
          height: "clamp(300px, 35vw, 500px)",
          background:
            "radial-gradient(ellipse at center, var(--nyx-cyan-400) 0%, transparent 70%)",
          opacity: 0.06,
          filter: "blur(60px)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/3 -translate-y-1/4"
        style={{
          width: "clamp(400px, 50vw, 700px)",
          height: "clamp(250px, 30vw, 400px)",
          background:
            "radial-gradient(ellipse at center, var(--nyx-orange-400) 0%, transparent 70%)",
          opacity: 0.04,
          filter: "blur(80px)",
        }}
      />

      <div className="relative mx-auto max-w-3xl px-6 pt-32 pb-20 text-center md:pt-40 md:pb-28">
      <motion.div {...fade(0)}>
        <Badge>Automação de vídeos dark</Badge>
      </motion.div>

      <motion.h1
        className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl"
        {...fade(0.08)}
      >
        Configure uma vez.
        <br />
        <span className="inline-grid items-center justify-center">
          {/* Invisible spacers — all phrases stacked so grid takes the tallest */}
          {["Produza para sempre._", "Escale sem esforço._", "Publique em minutos._"].map((phrase) => (
            <span key={phrase} className="invisible col-start-1 row-start-1" aria-hidden="true">
              {phrase}
            </span>
          ))}
          <span className="col-start-1 row-start-1">
            <Typewriter
              text={[
                "Produza para sempre.",
                "Escale sem esforço.",
                "Publique em minutos.",
              ]}
              className="text-gradient"
              speed={70}
              deleteSpeed={40}
              waitTime={2500}
            />
          </span>
        </span>
      </motion.h1>

      <motion.p
        className="mx-auto mt-6 max-w-xl text-lg text-nyx-text-secondary"
        {...fade(0.16)}
      >
        Transforme texto em videos dark prontos para o YouTube. Templates
        visuais, TTS automatico, legendas karaoke — tudo renderizado em
        minutos.
      </motion.p>

      <motion.div
        className="mt-8 flex flex-wrap items-center justify-center gap-3"
        {...fade(0.24)}
      >
        <Button size="lg">
          Comece gratis <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="lg">
          Ver como funciona
        </Button>
      </motion.div>

      {/* Trust stats */}
      <motion.div
        className="mt-16 flex flex-wrap items-center justify-center gap-6 text-sm text-nyx-text-muted"
        {...fade(0.32)}
      >
        {LOGOS.map((stat, i) => (
          <span key={stat} className="flex items-center gap-2">
            {i > 0 && <span className="hidden text-nyx-border md:inline">|</span>}
            {stat}
          </span>
        ))}
      </motion.div>
      </div>
    </section>
  );
}
