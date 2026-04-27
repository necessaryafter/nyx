import { Link } from "react-router-dom";
import { Upload, LayoutTemplate, Play, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "../ui/Button";
import type { ElementType } from "react";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 16 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

interface StepProps {
  step: number;
  icon: ElementType;
  title: string;
  description: string;
  href: string;
  cta: string;
  delay: number;
}

function StepCard({
  step,
  icon: Icon,
  title,
  description,
  href,
  cta,
  delay,
}: StepProps) {
  return (
    <motion.div {...fade(delay)}>
      <Link
        to={href}
        className="group flex h-full flex-col items-center gap-4 rounded-xl border border-nyx-border bg-nyx-surface p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-nyx-hover hover:shadow-lg"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-nyx-elevated font-mono text-sm font-bold text-nyx-text-muted">
          {step}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-nyx-cyan-500/10 text-nyx-cyan-500">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold text-nyx-text-primary">
            {title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-nyx-text-muted">
            {description}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="mt-auto">
          {cta} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </motion.div>
  );
}

interface EmptyDashboardProps {
  userName: string;
  credits: number;
}

export function EmptyDashboard({ userName, credits }: EmptyDashboardProps) {
  const firstName = userName.split(" ")[0];

  return (
    <div className="flex flex-col items-center py-8">
      {/* Subtle glow background */}
      <div className="relative w-full max-w-2xl">
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
          style={{
            width: "500px",
            height: "300px",
            background:
              "radial-gradient(ellipse at center, var(--nyx-cyan-400) 0%, transparent 70%)",
            opacity: 0.04,
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* Welcome */}
      <motion.div className="text-center" {...fade(0)}>
        <h1 className="font-display text-2xl font-bold text-nyx-text-primary">
          Bem-vindo ao Nyx, {firstName}!
        </h1>
        <p className="mt-2 text-sm text-nyx-text-secondary">
          Você tem{" "}
          <span className="font-mono font-semibold text-nyx-cyan-500">
            {credits}
          </span>{" "}
          créditos na conta — suficiente para seu primeiro vídeo.
        </p>
      </motion.div>

      {/* Steps heading */}
      <motion.p
        className="mt-10 mb-6 text-xs font-semibold uppercase tracking-wider text-nyx-text-muted"
        {...fade(0.15)}
      >
        Comece em 3 passos
      </motion.p>

      {/* Steps grid */}
      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        <StepCard
          step={1}
          icon={Upload}
          title="Upload assets"
          description="Faça upload dos seus vídeos de background e áudios"
          href="/assets"
          cta="Upload"
          delay={0.2}
        />

        {/* Arrow connector (desktop) */}
        <div className="hidden items-center justify-center sm:flex">
          <StepCard
            step={2}
            icon={LayoutTemplate}
            title="Crie um template"
            description="Monte seu primeiro template no editor visual"
            href="/templates/new"
            cta="Criar"
            delay={0.3}
          />
        </div>
        <div className="sm:hidden">
          <StepCard
            step={2}
            icon={LayoutTemplate}
            title="Crie um template"
            description="Monte seu primeiro template no editor visual"
            href="/templates/new"
            cta="Criar"
            delay={0.3}
          />
        </div>

        <StepCard
          step={3}
          icon={Play}
          title="Renderize"
          description="Clique em Render e pronto — seu vídeo fica pronto em minutos"
          href="/jobs/new"
          cta="Render"
          delay={0.4}
        />
      </div>
    </div>
  );
}
