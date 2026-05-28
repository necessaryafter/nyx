import { useState } from "react";
import { motion } from "motion/react";
import {
  Coins,
  Clapperboard,
  Mic,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { cn } from "../lib/cn";
import { useCreditsBalance, useCreditHistory } from "../hooks/useCredits";
import type { CreditTransaction } from "../hooks/useCredits";

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const PACKAGES = [
  {
    name: "Starter",
    credits: 100,
    price: "R$ 19",
    pricePerCredit: "R$0,19/cr",
    renders: "~3 renders",
    popular: false,
  },
  {
    name: "Creator",
    credits: 500,
    price: "R$ 79",
    pricePerCredit: "R$0,16/cr",
    renders: "~16 renders",
    popular: false,
  },
  {
    name: "Pro",
    credits: 1500,
    price: "R$ 199",
    pricePerCredit: "R$0,13/cr",
    renders: "~50 renders",
    popular: true,
  },
  {
    name: "Studio",
    credits: 5000,
    price: "R$ 499",
    pricePerCredit: "R$0,10/cr",
    renders: "~166 renders",
    popular: false,
  },
] as const;

type ReasonFilter = "all" | "render" | "tts" | "purchase";

const REASON_FILTERS: { label: string; value: ReasonFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "Render", value: "render" },
  { label: "TTS", value: "tts" },
  { label: "Compra", value: "purchase" },
];

function ReasonBadge({ reason }: { reason: CreditTransaction["reason"] }) {
  const map = {
    render: { label: "Render", icon: Clapperboard, cls: "text-orange-400 bg-orange-500/10" },
    tts: { label: "TTS", icon: Mic, cls: "text-nyx-cyan-500 bg-nyx-cyan-500/10" },
    purchase: { label: "Compra", icon: ShoppingCart, cls: "text-green-400 bg-green-500/10" },
  } as const;

  const { label, icon: Icon, cls } = map[reason];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function BalanceCard() {
  const balance = useCreditsBalance();
  const credits = balance.data?.balance ?? 0;

  const lowBalance = credits < 50;
  const criticalBalance = credits < 10;

  return (
    <motion.div
      className="rounded-2xl border border-nyx-border bg-nyx-surface p-6"
      {...fade(0)}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-nyx-text-muted">Seu saldo</p>

          {balance.isPending ? (
            <Skeleton className="mt-2 h-10 w-32" />
          ) : (
            <div className="mt-1 flex items-end gap-2">
              <span
                className={cn(
                  "font-display text-5xl font-bold leading-none",
                  criticalBalance
                    ? "text-red-400"
                    : lowBalance
                      ? "text-orange-400"
                      : "text-nyx-text-primary",
                )}
              >
                {credits.toLocaleString("pt-BR")}
              </span>
              <span className="pb-1 text-lg text-nyx-text-secondary">créditos</span>
            </div>
          )}

          {lowBalance && !balance.isPending && (
            <p
              className={cn(
                "mt-2 text-xs",
                criticalBalance ? "text-red-400" : "text-orange-400",
              )}
            >
              {criticalBalance
                ? "⚠ Saldo crítico! Compre mais créditos agora."
                : "⚠ Saldo baixo. Considere comprar mais créditos."}
            </p>
          )}
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-nyx-cyan-500/10">
          <Coins className="h-6 w-6 text-nyx-cyan-500" />
        </div>
      </div>
    </motion.div>
  );
}

function PricingCard({
  pkg,
  index,
}: {
  pkg: (typeof PACKAGES)[number];
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: 0.1 + index * 0.07,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        "relative flex flex-col gap-4 rounded-2xl border p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl",
        pkg.popular
          ? "border-nyx-orange-500 bg-nyx-surface shadow-[0_0_30px_rgba(249,115,22,0.08)]"
          : "border-nyx-border bg-nyx-surface hover:border-nyx-hover",
      )}
    >
      {pkg.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-nyx-orange-500 px-3 py-0.5 text-xs font-semibold text-white">
          Popular
        </span>
      )}

      <div>
        <p className="font-display text-lg font-semibold text-nyx-text-primary">
          {pkg.name}
        </p>
        <div className="mt-2 flex items-end gap-1.5">
          <span className="font-display text-3xl font-bold text-nyx-text-primary">
            {pkg.credits.toLocaleString("pt-BR")}
          </span>
          <span className="pb-0.5 text-sm text-nyx-text-muted">créditos</span>
        </div>
      </div>

      <div>
        <p className="text-2xl font-semibold text-nyx-text-primary">{pkg.price}</p>
        <p className="mt-0.5 font-mono text-xs text-nyx-text-muted">{pkg.pricePerCredit}</p>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-nyx-text-muted">
        <Clapperboard className="h-3.5 w-3.5 shrink-0" />
        {pkg.renders}
      </div>

      <Button
        variant="primary"
        size="md"
        className={cn(
          "mt-auto",
          pkg.popular
            ? "!bg-nyx-orange-500 hover:!opacity-90"
            : "!bg-nyx-surface !text-nyx-cyan-500 border border-nyx-cyan-500 hover:!bg-nyx-cyan-500/10",
        )}
      >
        Comprar
      </Button>
    </motion.div>
  );
}

function TransactionRow({ tx, index }: { tx: CreditTransaction; index: number }) {
  const isCredit = tx.amount > 0;

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03 }}
      className="border-b border-nyx-border transition-colors hover:bg-nyx-surface/50"
    >
      <td className="px-4 py-3.5 font-mono text-xs text-nyx-text-muted">
        {new Date(tx.createdAt).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        })}{" "}
        {new Date(tx.createdAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </td>
      <td className="px-4 py-3.5">
        <ReasonBadge reason={tx.reason} />
      </td>
      <td className="hidden px-4 py-3.5 text-sm text-nyx-text-secondary lg:table-cell">
        {tx.description ?? (tx.jobId ? `Job #${tx.jobId.slice(0, 8)}` : "—")}
      </td>
      <td className="px-4 py-3.5 text-right">
        <span
          className={cn(
            "font-mono text-sm font-medium",
            isCredit ? "text-green-400" : "text-nyx-text-muted",
          )}
        >
          {isCredit ? "+" : ""}
          {tx.amount} cr
        </span>
      </td>
    </motion.tr>
  );
}

export function CreditsPage() {
  const [historyPage, setHistoryPage] = useState(0);
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");

  const history = useCreditHistory(
    historyPage,
    reasonFilter === "all" ? undefined : reasonFilter,
  );

  const total = history.data?.total ?? 0;
  const limit = 20;
  const totalPages = Math.ceil(total / limit);
  const hasHistory = (history.data?.data.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.h1
        className="font-display text-xl font-bold text-nyx-text-primary"
        {...fade(0)}
      >
        Créditos
      </motion.h1>

      {/* Balance card */}
      <BalanceCard />

      {/* Packages */}
      <div>
        <motion.div
          className="mb-4 flex items-center gap-2"
          {...fade(0.08)}
        >
          <TrendingUp className="h-4 w-4 text-nyx-text-muted" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-nyx-text-muted">
            Pacotes de créditos
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PACKAGES.map((pkg, i) => (
            <PricingCard key={pkg.name} pkg={pkg} index={i} />
          ))}
        </div>
      </div>

      {/* History */}
      <div>
        <motion.div
          className="mb-4 flex items-center justify-between gap-4"
          {...fade(0.15)}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-nyx-text-muted">
            Histórico de transações
          </h2>

          {/* Reason filter tabs */}
          <div className="flex gap-1">
            {REASON_FILTERS.map((f) => {
              const active = reasonFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => {
                    setReasonFilter(f.value);
                    setHistoryPage(0);
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-nyx-elevated text-nyx-text-primary"
                      : "text-nyx-text-muted hover:text-nyx-text-secondary",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {history.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : !hasHistory ? (
          <motion.div
            className="flex flex-col items-center gap-3 rounded-2xl border border-nyx-border bg-nyx-surface py-12 text-center"
            {...fade(0.2)}
          >
            <Coins className="h-12 w-12 text-nyx-text-muted opacity-40" />
            <p className="text-sm text-nyx-text-muted">
              {reasonFilter !== "all"
                ? "Nenhuma transação desse tipo ainda"
                : "Nenhuma transação ainda"}
            </p>
          </motion.div>
        ) : (
          <motion.div
            className="overflow-hidden rounded-xl border border-nyx-border"
            {...fade(0.18)}
          >
            <table className="w-full">
              <thead>
                <tr className="border-b border-nyx-border bg-nyx-surface">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">
                    Tipo
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-nyx-text-muted lg:table-cell">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-nyx-text-muted">
                    Créditos
                  </th>
                </tr>
              </thead>
              <tbody className="bg-nyx-deep">
                {history.data!.data.map((tx, i) => (
                  <TransactionRow key={tx.id} tx={tx} index={i} />
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* History pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
              disabled={historyPage === 0}
            >
              Anterior
            </Button>
            <span className="font-mono text-xs text-nyx-text-muted">
              {historyPage + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={historyPage >= totalPages - 1}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
