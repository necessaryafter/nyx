import { useEffect, useRef, useState, type ElementType } from "react";
import { Link } from "react-router-dom";
import { Coins, Film, LayoutTemplate, FolderOpen } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { CreditsBalance, PaginatedResponse, Job } from "../../lib/types";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/cn";

function useCountUp(target: number, duration = 700): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

interface StatCardProps {
  icon: ElementType;
  label: string;
  value: string | number | undefined;
  subInfo?: string;
  color: "cyan" | "orange";
  href: string;
  isLoading: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subInfo,
  color,
  href,
  isLoading,
}: StatCardProps) {
  const numericTarget = typeof value === "number" ? value : 0;
  const animatedCount = useCountUp(numericTarget);
  const displayValue = isLoading
    ? null
    : typeof value === "number"
      ? animatedCount
      : (value ?? "—");

  return (
    <Link
      to={href}
      className={cn(
        "group flex flex-col gap-3 rounded-xl border border-nyx-border bg-nyx-surface p-5 transition-all duration-150",
        "hover:-translate-y-0.5 hover:border-nyx-hover hover:shadow-lg",
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            color === "cyan"
              ? "bg-nyx-cyan-500/10 text-nyx-cyan-500"
              : "bg-nyx-orange-500/10 text-nyx-orange-500",
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <span className="text-xs text-nyx-text-muted">{label}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : (
        <div>
          <p className="font-mono text-3xl font-bold text-nyx-text-primary">
            {displayValue}
          </p>
          {subInfo && (
            <p className="mt-1 text-xs text-nyx-text-muted">{subInfo}</p>
          )}
        </div>
      )}
    </Link>
  );
}

function countJobsToday(jobs: Job[]): number {
  const today = new Date().toDateString();
  return jobs.filter((j) => new Date(j.createdAt).toDateString() === today)
    .length;
}

interface StatsGridProps {
  credits: UseQueryResult<CreditsBalance>;
  jobs: UseQueryResult<PaginatedResponse<Job>>;
  templateCount: UseQueryResult<number>;
  assetCount: UseQueryResult<number>;
}

export function StatsGrid({
  credits,
  jobs,
  templateCount,
  assetCount,
}: StatsGridProps) {
  const jobsToday = jobs.data ? countJobsToday(jobs.data.data) : 0;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatCard
        icon={Coins}
        label="Créditos"
        value={credits.data?.balance}
        color="cyan"
        href="/credits"
        isLoading={credits.isPending}
      />
      <StatCard
        icon={Film}
        label="Jobs hoje"
        value={jobsToday}
        subInfo={
          jobs.data ? `${jobs.data.total} no total` : undefined
        }
        color="orange"
        href="/jobs"
        isLoading={jobs.isPending}
      />
      <StatCard
        icon={LayoutTemplate}
        label="Templates"
        value={templateCount.data}
        color="cyan"
        href="/templates"
        isLoading={templateCount.isPending}
      />
      <StatCard
        icon={FolderOpen}
        label="Assets"
        value={assetCount.data}
        color="orange"
        href="/assets"
        isLoading={assetCount.isPending}
      />
    </div>
  );
}
