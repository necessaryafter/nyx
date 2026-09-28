import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authClient } from "../../lib/auth";
import { useSidebar } from "../../hooks/useSidebar";
import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";
import { BottomNav } from "./BottomNav";

export function DashboardLayout() {
  const { data: session, isPending, error } = authClient.useSession();
  const navigate = useNavigate();
  const { collapsed, toggle } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Só manda pro login quando o backend confirma "sem sessão" — uma falha de
  // rede/backend fora do ar (error preenchido) não pode ser lida como logout,
  // senão qualquer soluço momentâneo derruba o usuário no meio do trabalho.
  useEffect(() => {
    if (!session && !isPending && !error) {
      navigate("/login", { replace: true });
    }
  }, [session, isPending, error, navigate]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nyx-void">
        <Loader2 className="h-6 w-6 animate-spin text-nyx-text-muted" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex min-h-screen bg-nyx-void">
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

        <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
