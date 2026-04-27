import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Sun, Moon, Monitor, LogOut, Settings, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { authClient } from "../../lib/auth";
import { useTheme } from "../../lib/useTheme";

const THEME_META = {
  system: { icon: Monitor, label: "Sistema" },
  light: { icon: Sun, label: "Claro" },
  dark: { icon: Moon, label: "Escuro" },
} as const;

interface DashboardHeaderProps {
  onMenuToggle: () => void;
  user: { name: string; image?: string | null };
}

export function DashboardHeader({ onMenuToggle, user }: DashboardHeaderProps) {
  const { theme, cycleTheme } = useTheme();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const ThemeIcon = THEME_META[theme].icon;

  // Close dropdown on outside click
  useEffect(() => {
    if (!avatarOpen) return;
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [avatarOpen]);

  async function handleLogout() {
    await authClient.signOut();
    navigate("/");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-nyx-border bg-nyx-deep px-6">
      {/* Left: hamburger (mobile) + breadcrumb */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="text-nyx-text-muted hover:text-nyx-text-primary md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="font-display text-sm font-semibold text-nyx-text-primary">
          Dashboard
        </h2>
      </div>

      {/* Right: theme + avatar */}
      <div className="flex items-center gap-2">
        <button
          onClick={cycleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-nyx-text-muted transition-colors hover:bg-nyx-hover hover:text-nyx-text-primary"
          title={THEME_META[theme].label}
        >
          <ThemeIcon className="h-4 w-4" />
        </button>

        {/* Avatar dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setAvatarOpen(!avatarOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-nyx-hover"
          >
            {user.image ? (
              <img src={user.image} alt="" className="h-7 w-7 rounded-full" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-nyx-elevated text-xs font-medium text-nyx-text-secondary">
                {user.name?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 text-nyx-text-muted transition-transform duration-150 ${avatarOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {avatarOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-nyx-border bg-nyx-surface shadow-lg"
              >
                <div className="border-b border-nyx-border px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-nyx-text-primary">
                    {user.name}
                  </p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setAvatarOpen(false);
                      navigate("/settings");
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-nyx-text-secondary transition-colors hover:bg-nyx-hover hover:text-nyx-text-primary"
                  >
                    <Settings className="h-4 w-4" />
                    Configurações
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-nyx-error transition-colors hover:bg-nyx-hover"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
