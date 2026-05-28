import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authClient } from "../../lib/auth";
import { useSidebar } from "../../hooks/useSidebar";
import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";
import { BottomNav } from "./BottomNav";

export function DashboardLayout() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const { collapsed, toggle } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!session && !isPending) navigate("/login", { replace: true });
  }, [session, isPending, navigate]);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-nyx-void">
        <Loader2 className="h-5 w-5 animate-spin text-nyx-3" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex min-h-dvh bg-nyx-void">
      <Sidebar
        collapsed={collapsed}
        onToggle={toggle}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        user={session.user}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          onMenuToggle={() => setMobileOpen(true)}
          user={session.user}
        />

        <main className="flex-1 overflow-y-auto p-5 pb-20 md:pb-5">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
