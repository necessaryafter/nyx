import { Link } from "react-router-dom";
import { Plus, Upload, Play } from "lucide-react";
import { cn } from "../../lib/cn";
import type { ElementType } from "react";

interface ActionCardProps {
  icon: ElementType;
  label: string;
  href: string;
  accent?: boolean;
}

function ActionCard({ icon: Icon, label, href, accent }: ActionCardProps) {
  return (
    <Link
      to={href}
      className={cn(
        "group flex h-20 flex-col items-center justify-center gap-2 rounded-xl border transition-all duration-200",
        "hover:scale-[1.02]",
        accent
          ? "border-nyx-orange-500/30 bg-nyx-orange-500/10 text-nyx-orange-500 hover:border-nyx-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.08)]"
          : "border-nyx-border bg-nyx-surface text-nyx-text-secondary hover:border-nyx-hover hover:text-nyx-text-primary hover:shadow-[0_0_20px_rgba(6,182,212,0.06)]",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <ActionCard icon={Plus} label="Novo Template" href="/templates/new" />
      <ActionCard icon={Upload} label="Upload Asset" href="/assets" />
      <ActionCard icon={Play} label="Render Rápido" href="/jobs/new" accent />
    </div>
  );
}
