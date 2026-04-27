import { useState } from "react";
import { Clock, RefreshCw, TrendingDown } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { SectionWrapper } from "../ui/SectionWrapper";
import { SectionHeading } from "../ui/SectionHeading";
import { AnimatedEntry } from "../ui/AnimatedEntry";
import { TextRotate } from "../ui/TextRotate";

const PAIN_POINTS = [
  {
    icon: Clock,
    title: "Horas por video",
    description:
      "Um video de 10 minutos consome 2-4 horas. Editar audio, sincronizar legendas, exportar — repeat.",
  },
  {
    icon: RefreshCw,
    title: "Mesmo processo, toda vez",
    description:
      "Download do post, gerar TTS, criar legenda, renderizar. Os mesmos 15 passos manuais pra cada video.",
  },
  {
    icon: TrendingDown,
    title: "Escalar = contratar",
    description:
      "Cada video extra significa mais horas ou mais um editor. A conta nao fecha.",
  },
];

export function PainPoints() {
  const [activeIndex, setActiveIndex] = useState(0);
  const ActiveIcon = PAIN_POINTS[activeIndex].icon;

  return (
    <SectionWrapper>
      <AnimatedEntry>
        <SectionHeading>
          Criar vídeos dark manualmente não escala.
        </SectionHeading>
      </AnimatedEntry>

      <AnimatedEntry>
        <div className="mx-auto mt-12 max-w-xl text-center">
          {/* Rotating title */}
          <div className="flex items-center justify-center gap-3">
            <AnimatePresence mode="wait">
              <motion.span
                key={activeIndex}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <ActiveIcon className="h-5 w-5 text-nyx-error" />
              </motion.span>
            </AnimatePresence>

            <LayoutGroup>
              <TextRotate
                texts={PAIN_POINTS.map((p) => p.title)}
                mainClassName="font-display text-xl font-bold text-nyx-text-primary md:text-2xl overflow-hidden justify-center"
                staggerFrom="last"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "-120%" }}
                staggerDuration={0.025}
                splitLevelClassName="overflow-hidden pb-0.5"
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
                rotationInterval={3500}
                onNext={setActiveIndex}
              />
            </LayoutGroup>
          </div>

          {/* Synced description */}
          <div className="relative mt-4 min-h-[3rem]">
            <AnimatePresence mode="wait">
              <motion.p
                key={activeIndex}
                className="text-sm leading-relaxed text-nyx-text-muted md:text-base"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {PAIN_POINTS[activeIndex].description}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {PAIN_POINTS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? "w-6 bg-nyx-error"
                    : "w-1.5 bg-nyx-border"
                }`}
              />
            ))}
          </div>
        </div>
      </AnimatedEntry>
    </SectionWrapper>
  );
}
