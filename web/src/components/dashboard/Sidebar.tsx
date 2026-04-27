import { useLocation, Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard,
  LayoutTemplate,
  FolderOpen,
  Film,
  Coins,
  Store,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "../../lib/cn";

const NAV_SECTIONS = [
  {
    label: "PRINCIPAL",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Templates", href: "/templates", icon: LayoutTemplate },
      { label: "Assets", href: "/assets", icon: FolderOpen },
      { label: "Jobs", href: "/jobs", icon: Film },
    ],
  },
  {
    label: "CONTA",
    items: [
      { label: "Créditos", href: "/credits", icon: Coins },
      { label: "Marketplace", href: "/marketplace", icon: Store },
      { label: "Configurações", href: "/settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  user: { name: string; image?: string | null };
}

function NavContent({
  collapsed,
  onToggle,
  user,
  onLinkClick,
}: {
  collapsed: boolean;
  onToggle: () => void;
  user: { name: string; image?: string | null };
  onLinkClick?: () => void;
}) {
  const location = useLocation();

  return (
    <nav
      className={cn(
        "flex h-full flex-col border-r border-nyx-border bg-nyx-deep transition-[width] duration-250 ease-out",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center border-b border-nyx-border px-4">
        <Link
          to="/"
          className="font-logo tracking-[0.2em] text-nyx-text-primary"
        >
          {collapsed ? "N" : "NYX"}
        </Link>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-nyx-text-muted">
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const active = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onLinkClick}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "mx-2 mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
                    collapsed && "justify-center px-0",
                    active
                      ? "border-l-2 border-nyx-cyan-500 bg-nyx-cyan-900/30 text-nyx-text-primary"
                      : "border-l-2 border-transparent text-nyx-text-secondary hover:bg-nyx-hover hover:text-nyx-text-primary",
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="border-t border-nyx-border p-3">
        <div
          className={cn(
            "flex items-center gap-3",
            collapsed && "justify-center",
          )}
        >
          {user.image ? (
            <img
              src={user.image}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nyx-elevated text-xs font-medium text-nyx-text-secondary">
              {user.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
          )}
          {!collapsed && (
            <span className="truncate text-sm text-nyx-text-secondary">
              {user.name}
            </span>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="hidden border-t border-nyx-border p-3 text-nyx-text-muted transition-colors hover:text-nyx-text-primary md:flex md:items-center md:justify-center"
      >
        {collapsed ? (
          <ChevronsRight className="h-4 w-4" />
        ) : (
          <ChevronsLeft className="h-4 w-4" />
        )}
      </button>
    </nav>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  user,
}: SidebarProps) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden shrink-0 md:block">
        <NavContent collapsed={collapsed} onToggle={onToggle} user={user} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <NavContent
                collapsed={false}
                onToggle={onToggle}
                user={user}
                onLinkClick={onMobileClose}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
