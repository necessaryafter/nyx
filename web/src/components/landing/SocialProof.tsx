import { SectionHeading } from "../ui/SectionHeading";
import { AnimatedEntry } from "../ui/AnimatedEntry";

interface Testimonial {
  quote: string;
  name: string;
  handle: string;
  info: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Eu postava 3 videos por semana. Agora posto 12. O Nyx automatizou tudo que eu fazia manualmente.",
    name: "Lucas Mendes",
    handle: "@darkstories",
    info: "142k inscritos",
  },
  {
    quote:
      "Meu canal saiu de 2k pra 45k inscritos em 4 meses. A consistencia fez toda a diferenca.",
    name: "Ana Costa",
    handle: "@redditreads",
    info: "45k inscritos",
  },
  {
    quote:
      "Gerencio 5 canais. Configuro o template uma vez e so troco o texto. Produtividade insana.",
    name: "Rafael Souza",
    handle: "@contentfactory",
    info: "Agency · 8 canais",
  },
  {
    quote:
      "O editor de nodes e intuitivo demais. Em 10 minutos ja tinha meu primeiro template pronto.",
    name: "Camila Ferreira",
    handle: "@camiladark",
    info: "67k inscritos",
  },
  {
    quote:
      "Parei de gastar R$2k/mes com editor freelancer. O Nyx faz tudo sozinho, melhor e mais rapido.",
    name: "Thiago Lima",
    handle: "@horrorstoriesbr",
    info: "230k inscritos",
  },
  {
    quote:
      "As legendas karaoke sincronizadas foram o diferencial. Meus videos ficaram muito mais profissionais.",
    name: "Juliana Alves",
    handle: "@motivadaily",
    info: "89k inscritos",
  },
];

function TestimonialCard({ quote, name, handle, info }: Testimonial) {
  return (
    <div className="flex w-[320px] shrink-0 flex-col rounded-xl border border-nyx-border bg-nyx-surface p-5">
      <p className="flex-1 text-sm leading-relaxed text-nyx-text-secondary">
        "{quote}"
      </p>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-nyx-elevated text-xs font-medium text-nyx-text-muted">
          {name.split(" ").map((n) => n[0]).join("")}
        </div>
        <div>
          <p className="text-sm font-medium text-nyx-text-primary">{handle}</p>
          <p className="text-xs text-nyx-text-muted">{info}</p>
        </div>
      </div>
    </div>
  );
}

export function SocialProof() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <AnimatedEntry>
          <SectionHeading>Usado por criadores que escalam</SectionHeading>
        </AnimatedEntry>
      </div>

      <AnimatedEntry>
        <div className="relative overflow-hidden">
          {/* Marquee row */}
          <div className="group flex overflow-hidden [--duration:45s] [--gap:1rem]">
            <div className="flex shrink-0 animate-marquee gap-[var(--gap)]">
              {[...Array(4)].flatMap((_, setIdx) =>
                TESTIMONIALS.map((t, i) => (
                  <TestimonialCard key={`${setIdx}-${i}`} {...t} />
                )),
              )}
            </div>
          </div>

          {/* Fade edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-nyx-void sm:w-40" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-nyx-void sm:w-40" />
        </div>
      </AnimatedEntry>

      <p className="mt-8 text-center text-xs text-nyx-text-muted">
        * Depoimentos representativos. Dados reais com usuarios ativos em breve.
      </p>
    </section>
  );
}
