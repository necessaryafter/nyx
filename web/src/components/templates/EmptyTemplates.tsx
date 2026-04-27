import { Link } from "react-router-dom";
import { LayoutTemplate, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "../ui/Button";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 16 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function EmptyTemplates() {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <motion.div
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-nyx-cyan-500/10"
        {...fade(0)}
      >
        <LayoutTemplate className="h-8 w-8 text-nyx-cyan-500/60" />
      </motion.div>

      <motion.div className="mt-6" {...fade(0.1)}>
        <p className="font-display text-base font-semibold text-nyx-text-primary">
          Nenhum template ainda
        </p>
        <p className="mt-2 max-w-xs text-sm text-nyx-text-muted">
          Templates definem a "máquina" do seu vídeo. Crie seu primeiro para
          começar a renderizar.
        </p>
      </motion.div>

      <motion.div className="mt-6" {...fade(0.2)}>
        <Link to="/templates/new">
          <Button variant="primary" size="md">
            Criar template <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
