import { motion } from "motion/react";
import { authClient } from "../lib/auth";
import {
  useCreditsBalance,
  useRecentJobs,
  useTemplatesCount,
  useAssetsCount,
} from "../hooks/useDashboardData";
import { Greeting } from "../components/dashboard/Greeting";
import { StatsGrid } from "../components/dashboard/StatsGrid";
import { QuickActions } from "../components/dashboard/QuickActions";
import { RecentJobs } from "../components/dashboard/RecentJobs";
import { EmptyDashboard } from "../components/dashboard/EmptyDashboard";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function DashboardPage() {
  const { data: session } = authClient.useSession();
  const credits = useCreditsBalance();
  const jobs = useRecentJobs(5);
  const templateCount = useTemplatesCount();
  const assetCount = useAssetsCount();

  // New user: all counts zero and not loading
  const isNewUser =
    !templateCount.isPending &&
    !assetCount.isPending &&
    !jobs.isPending &&
    templateCount.data === 0 &&
    assetCount.data === 0 &&
    (jobs.data?.total ?? 0) === 0;

  if (isNewUser) {
    return (
      <EmptyDashboard
        userName={session?.user.name ?? ""}
        credits={credits.data?.balance ?? 0}
      />
    );
  }

  return (
    <div className="space-y-8">
      <motion.div {...fade(0)}>
        <Greeting name={session?.user.name ?? ""} />
      </motion.div>

      <motion.div {...fade(0.05)}>
        <StatsGrid
          credits={credits}
          jobs={jobs}
          templateCount={templateCount}
          assetCount={assetCount}
        />
      </motion.div>

      <motion.div {...fade(0.1)}>
        <QuickActions />
      </motion.div>

      <motion.div {...fade(0.15)}>
        <RecentJobs jobs={jobs} />
      </motion.div>
    </div>
  );
}
