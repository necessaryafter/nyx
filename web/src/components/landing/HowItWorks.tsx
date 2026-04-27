import type { ReactNode } from "react";
import { Workflow, MessageSquareText, Download } from "lucide-react";
import { SectionWrapper } from "../ui/SectionWrapper";
import { SectionHeading } from "../ui/SectionHeading";
import { AnimatedEntry, AnimatedItem } from "../ui/AnimatedEntry";

interface StepCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  benefits: string[];
}

function StepCard({ icon, title, description, benefits }: StepCardProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-nyx-border bg-nyx-surface p-6 transition-colors duration-300 hover:border-nyx-text-muted/30 hover:bg-nyx-elevated">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-nyx-elevated text-nyx-text-muted">
        {icon}
      </div>
      <h3 className="mb-2 text-base font-semibold text-nyx-text-primary">
        {title}
      </h3>
      <p className="mb-5 text-sm leading-relaxed text-nyx-text-muted">
        {description}
      </p>
      <ul className="mt-auto space-y-2">
        {benefits.map((benefit) => (
          <li key={benefit} className="flex items-center gap-2.5 text-sm text-nyx-text-secondary">
            <span className="h-1 w-1 shrink-0 rounded-full bg-nyx-text-muted" />
            {benefit}
          </li>
        ))}
      </ul>
    </div>
  );
}

const STEPS = [
  {
    icon: <Workflow className="h-5 w-5" />,
    title: "Monte seu template",
    description:
      "Arraste nodes e conecte seu pipeline de vídeo visualmente. VideoPool, TTS, Legendas, Layer — tudo plug & play.",
    benefits: [
      "Editor visual drag & drop",
      "Nodes pré-configurados",
      "Templates reutilizáveis",
    ],
  },
  {
    icon: <MessageSquareText className="h-5 w-5" />,
    title: "Insira o conteúdo",
    description:
      "Cole o roteiro ou envie seu áudio, escolha a voz do TTS. O Nyx cuida da narração e da sincronização.",
    benefits: [
      "Múltiplas vozes de TTS",
      "Legendas karaokê automáticas",
      "Sincronização por palavra",
    ],
  },
  {
    icon: <Download className="h-5 w-5" />,
    title: "Renderize e baixe",
    description:
      "Um clique. O Nyx renderiza em background, gera legenda karaokê, e entrega o MP4 pronto.",
    benefits: [
      "Renderização em minutos",
      "Música de fundo automática",
      "Download direto do MP4",
    ],
  },
];

export function HowItWorks() {
  return (
    <SectionWrapper id="how-it-works">
      <AnimatedEntry>
        <SectionHeading subtitle="Da ideia ao vídeo publicado em três passos.">
          Como funciona
        </SectionHeading>
      </AnimatedEntry>

      {/* Step indicators with connecting line */}
      <AnimatedEntry>
        <div className="relative mx-auto mb-8 w-full max-w-4xl">
          <div
            aria-hidden="true"
            className="absolute left-[16.6667%] top-1/2 h-px w-[66.6667%] -translate-y-1/2 bg-nyx-border"
          />
          <div className="relative grid grid-cols-3">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className="flex h-8 w-8 items-center justify-center justify-self-center rounded-full bg-nyx-elevated font-mono text-sm font-semibold text-nyx-text-primary ring-4 ring-nyx-void"
              >
                {index + 1}
              </div>
            ))}
          </div>
        </div>
      </AnimatedEntry>

      {/* Step cards */}
      <AnimatedEntry stagger className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((step) => (
          <AnimatedItem key={step.title}>
            <StepCard
              icon={step.icon}
              title={step.title}
              description={step.description}
              benefits={step.benefits}
            />
          </AnimatedItem>
        ))}
      </AnimatedEntry>
    </SectionWrapper>
  );
}
