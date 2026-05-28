import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Settings, ChevronDown, Menu } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { authClient } from "../../lib/auth";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/templates": "Templates",
  "/jobs":      "Jobs",
  "/assets":    "Assets",
  "/credits":   "Créditos",
  "/settings":  "Configurações",
};

interface DashboardHeaderProps {
  onMenuToggle: () => void;
  user: { name: string; image?: string | null };
}

export function DashboardHeader({ onMenuToggle, user }: DashboardHeaderProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname === path || pathname.startsWith(path + "/"),
  )?.[1] ?? "Nyx";

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function handleLogout() {
    await authClient.signOut();
    navigate("/");
  }

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-nyx-line bg-nyx-base px-4">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="text-nyx-3 hover:text-nyx-2 transition-colors md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="font-display text-xs font-semibold tracking-widest uppercase text-nyx-3">
          {title}
        </span>
      </div>

      {/* Right: avatar */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-[3px] px-2 py-1 transition-colors hover:bg-nyx-raised"
        >
          {user.image ? (
            <img src={user.image} alt="" className="h-5 w-5 rounded-full ring-1 ring-nyx-line" />
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-nyx-overlay text-[9px] font-display font-semibold text-nyx-2 ring-1 ring-nyx-line">
              {user.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
          )}
          <ChevronDown className={`h-3 w-3 text-nyx-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full z-50 mt-1 w-44 nyx-panel overflow-hidden"
            >
              <div className="border-b border-nyx-line px-3 py-2">
                <p className="truncate text-xs font-body text-nyx-2">{user.name}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setOpen(false); navigate("/settings"); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-body text-nyx-2 transition-colors hover:bg-nyx-hover hover:text-nyx-1"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Configurações
                </button>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-body text-nyx-red transition-colors hover:bg-nyx-hover"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
