import { ArrowRight } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { SectionWrapper } from "../ui/SectionWrapper";
import { AnimatedEntry } from "../ui/AnimatedEntry";

export function CTAFinal() {
  return (
    <SectionWrapper>
      <AnimatedEntry>
        <div className="relative flex flex-col items-center gap-8 overflow-hidden rounded-xl bg-nyx-surface p-8 text-center lg:p-14">
          {/* Gradient glow behind card */}
          <div
            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
            style={{
              width: "clamp(400px, 60vw, 800px)",
              height: "300px",
              background:
                "radial-gradient(ellipse at center, var(--nyx-cyan-400) 0%, transparent 70%)",
              opacity: 0.07,
              filter: "blur(60px)",
            }}
          />
          <div
            className="pointer-events-none absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4"
            style={{
              width: "400px",
              height: "250px",
              background:
                "radial-gradient(ellipse at center, var(--nyx-orange-400) 0%, transparent 70%)",
              opacity: 0.05,
              filter: "blur(70px)",
            }}
          />
          <Badge>Comece agora</Badge>
          <div className="flex flex-col gap-2">
            <h3 className="max-w-xl font-display text-3xl font-bold tracking-tight text-nyx-text-primary md:text-5xl">
              Pare de editar.{" "}
              <span className="text-gradient">Comece a escalar.</span>
            </h3>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-nyx-text-secondary">
              10 créditos grátis. Seu primeiro vídeo em menos de 10 minutos.
              Sem cartão de crédito.
            </p>
          </div>
          <div className="flex flex-row gap-4">
            <Button variant="secondary" size="lg">
              Ver como funciona
            </Button>
            <Button size="lg">
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </AnimatedEntry>
    </SectionWrapper>
  );
}
