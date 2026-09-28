import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, CalendarClock } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { SchedulerCard } from "../components/schedulers/SchedulerCard";
import { useSchedulers, useSchedulersWebSocket } from "../hooks/useSchedulers";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function SchedulersPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useSchedulersWebSocket();
  const schedulers = useSchedulers(page, debouncedSearch || undefined);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(0);
    clearTimeout((handleSearch as { timer?: ReturnType<typeof setTimeout> }).timer);
    (handleSearch as { timer?: ReturnType<typeof setTimeout> }).timer = setTimeout(() => setDebouncedSearch(value), 300);
  }

  const total = schedulers.data?.total ?? 0;
  const limit = 20;
  const totalPages = Math.ceil(total / limit);
  const hasData = (schedulers.data?.data.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <motion.div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" {...fade(0)}>
        <h1 className="font-display text-xl font-bold text-nyx-text-primary">Schedulers</h1>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nyx-text-muted" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 w-48 rounded-lg border border-nyx-border bg-nyx-surface pl-9 pr-3 text-sm text-nyx-text-primary placeholder:text-nyx-text-muted focus:border-nyx-cyan-500 focus:outline-none"
            />
          </div>
          <Link to="/schedulers/new">
            <Button variant="primary" size="sm">
              <Plus className="h-4 w-4" />
              Novo scheduler
            </Button>
          </Link>
        </div>
      </motion.div>

      {schedulers.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : !hasData ? (
        <motion.div className="flex flex-col items-center justify-center gap-4 py-20 text-center" {...fade(0.1)}>
          <CalendarClock className="h-16 w-16 text-nyx-text-muted opacity-40" />
          <div>
            <p className="text-lg font-medium text-nyx-text-primary">Nenhum scheduler ainda</p>
            <p className="mt-1 text-sm text-nyx-text-muted">Crie um pra gerar séries de vídeos sozinho.</p>
          </div>
          <Link to="/schedulers/new">
            <Button variant="secondary" size="sm">
              <Plus className="h-4 w-4" />
              Novo scheduler
            </Button>
          </Link>
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {schedulers.data!.data.map((scheduler, i) => (
              <motion.div key={scheduler.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <SchedulerCard scheduler={scheduler} />
              </motion.div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                Anterior
              </Button>
              <span className="text-sm text-nyx-text-muted">{page + 1} / {totalPages}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
