import { useState } from "react";
import { CheckCircle, Star } from "lucide-react";
import { Button } from "../ui/Button";
import { SectionWrapper } from "../ui/SectionWrapper";
import { SectionHeading } from "../ui/SectionHeading";
import { AnimatedEntry, AnimatedItem } from "../ui/AnimatedEntry";

interface Plan {
  name: string;
  description: string;
  price: string;
  credits: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

const PLANS: Plan[] = [
  {
    name: "Iniciante",
    description: "Para quem está começando no nicho",
    price: "19,90",
    credits: "120 créditos",
    features: [
      "~12 vídeos de 1 min",
      "TTS multi-provider",
      "Legendas karaokê",
      "Templates básicos",
      "Download em MP4",
    ],
    cta: "Começar agora",
  },
  {
    name: "Criador",
    description: "Para criadores ativos",
    price: "49,90",
    credits: "360 créditos",
    highlighted: true,
    features: [
      "~36 vídeos de 1 min",
      "Tudo do Iniciante",
      "Templates ilimitados",
      "Prioridade na fila",
      "Suporte prioritário",
    ],
    cta: "Começar agora",
  },
  {
    name: "Profissional",
    description: "Para escalar produção",
    price: "99,90",
    credits: "900 créditos",
    features: [
      "~90 vídeos de 1 min",
      "Tudo do Criador",
      "API de renderização",
      "Webhooks de status",
      "Suporte dedicado",
    ],
    cta: "Começar agora",
  },
];

const PRICE_PER_CREDIT = 0.2;
const PRESETS = [50, 150, 300, 500];

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-xl border ${
        plan.highlighted
          ? "border-nyx-cyan-400/40 bg-nyx-surface"
          : "border-nyx-border bg-nyx-surface"
      }`}
    >
      {/* Glow trail for highlighted */}
      {plan.highlighted && (
        <div className="pointer-events-none absolute inset-0 rounded-xl border border-nyx-cyan-400/20" />
      )}

      {/* Header */}
      <div
        className={`rounded-t-xl border-b border-nyx-border p-6 ${
          plan.highlighted ? "bg-nyx-elevated/50" : ""
        }`}
      >
        {plan.highlighted && (
          <span className="mb-3 inline-flex items-center gap-1 rounded-md border border-nyx-border bg-nyx-deep px-2 py-0.5 text-xs text-nyx-text-secondary">
            <Star className="h-3 w-3 fill-current" />
            Popular
          </span>
        )}
        <h3 className="text-lg font-semibold text-nyx-text-primary">
          {plan.name}
        </h3>
        <p className="mt-1 text-sm text-nyx-text-muted">{plan.description}</p>
        <div className="mt-4 flex items-end gap-1">
          <span className="text-3xl font-bold text-nyx-text-primary">
            R${plan.price}
          </span>
          <span className="mb-0.5 text-sm text-nyx-text-muted">/mês</span>
        </div>
        <p className="mt-1 font-mono text-xs text-nyx-text-muted">
          {plan.credits}
        </p>
      </div>

      {/* Features */}
      <div className="flex-1 space-y-3 p-6">
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-center gap-2.5">
            <CheckCircle className="h-4 w-4 shrink-0 text-nyx-text-muted" />
            <span className="text-sm text-nyx-text-secondary">{feature}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="border-t border-nyx-border p-4">
        <Button
          variant={plan.highlighted ? "primary" : "secondary"}
          size="md"
          className="w-full"
        >
          {plan.cta}
        </Button>
      </div>
    </div>
  );
}

function formatBRL(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function CreditSelector() {
  const [credits, setCredits] = useState(150);
  const total = credits * PRICE_PER_CREDIT;
  const videos = Math.floor(credits / 10);

  return (
    <div className="mx-auto mt-12 max-w-4xl">
      <div className="rounded-xl border border-nyx-border bg-nyx-surface p-6 md:p-8">
        <h3 className="text-base font-semibold text-nyx-text-primary">
          Precisa de mais? Compre créditos avulsos.
        </h3>
        <p className="mt-1 text-sm text-nyx-text-muted">
          Créditos extras não expiram e funcionam com qualquer plano.
        </p>

        {/* Presets */}
        <div className="mt-6 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setCredits(preset)}
              className={`cursor-pointer rounded-lg border px-4 py-2 font-mono text-sm transition-colors ${
                credits === preset
                  ? "border-nyx-text-muted/40 bg-nyx-elevated text-nyx-text-primary"
                  : "border-nyx-border text-nyx-text-muted hover:border-nyx-text-muted/30 hover:text-nyx-text-secondary"
              }`}
            >
              {preset}
            </button>
          ))}
          <div className="relative flex items-center">
            <input
              type="number"
              min={10}
              max={5000}
              step={10}
              value={!PRESETS.includes(credits) ? credits : ""}
              placeholder="Custom"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1) setCredits(Math.min(v, 5000));
              }}
              className="w-24 rounded-lg border border-nyx-border bg-nyx-deep px-3 py-2 font-mono text-sm text-nyx-text-primary placeholder:text-nyx-text-muted/60 focus:border-nyx-text-muted/40 focus:outline-none"
            />
          </div>
        </div>

        {/* Slider */}
        <div className="mt-4">
          <input
            type="range"
            min={10}
            max={1000}
            step={10}
            value={credits > 1000 ? 1000 : credits}
            onChange={(e) => setCredits(parseInt(e.target.value, 10))}
            className="slider-nyx w-full cursor-pointer"
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-nyx-text-muted/60">
            <span>10</span>
            <span>1000</span>
          </div>
        </div>

        {/* Result */}
        <div className="mt-6 flex flex-col gap-4 border-t border-nyx-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl font-bold text-nyx-text-primary">
              R${formatBRL(total)}
            </span>
            <span className="text-sm text-nyx-text-muted">
              por {credits} créditos
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-nyx-text-muted">
              ~{videos} vídeos de 1 min
            </span>
            <Button size="md">Comprar créditos</Button>
          </div>
        </div>

        {/* Breakdown */}
        <div className="mt-4 flex flex-wrap gap-6 text-xs text-nyx-text-muted">
          <span>
            <strong className="text-nyx-text-secondary">Render:</strong> 10
            cr/min
          </span>
          <span>
            <strong className="text-nyx-text-secondary">TTS externo:</strong> 5
            cr/min
          </span>
          <span>
            <strong className="text-nyx-text-secondary">TTS custom:</strong> 0
            cr
          </span>
        </div>
      </div>
    </div>
  );
}

export function Pricing() {
  return (
    <SectionWrapper id="pricing">
      <AnimatedEntry>
        <SectionHeading subtitle="Escolha o plano ideal ou compre créditos avulsos.">
          Planos que crescem com você.
        </SectionHeading>
      </AnimatedEntry>

      {/* Plan cards */}
      <AnimatedEntry
        stagger
        className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3"
      >
        {PLANS.map((plan) => (
          <AnimatedItem key={plan.name}>
            <PlanCard plan={plan} />
          </AnimatedItem>
        ))}
      </AnimatedEntry>

      {/* Pay as you go */}
      <AnimatedEntry>
        <CreditSelector />
      </AnimatedEntry>
    </SectionWrapper>
  );
}
