import { useLocation, Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard,
  LayoutTemplate,
  FolderOpen,
  Film,
  Coins,
  Settings,
  ChevronRight,
} from "lucide-react";
import { cn } from "../../lib/cn";

const NAV = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard },
  { label: "Templates",  href: "/templates",  icon: LayoutTemplate  },
  { label: "Jobs",       href: "/jobs",        icon: Film            },
  { label: "Assets",     href: "/assets",      icon: FolderOpen      },
  { label: "Créditos",   href: "/credits",     icon: Coins           },
  { label: "Config",     href: "/settings",    icon: Settings        },
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
  user: SidebarProps["user"];
  onLinkClick?: () => void;
}) {
  const { pathname } = useLocation();

  return (
    <nav
      className={cn(
        "flex h-full flex-col",
        "bg-nyx-base border-r border-nyx-line",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-12" : "w-48",
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex h-11 shrink-0 items-center border-b border-nyx-line",
        collapsed ? "justify-center px-0" : "px-4",
      )}>
        <Link
          to="/dashboard"
          className="font-logo text-sm font-semibold tracking-[0.18em] text-nyx-1 hover:text-nyx-teal transition-colors"
        >
          {collapsed ? "N" : "NYX"}
        </Link>
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onLinkClick}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-3 mx-1 my-0.5 px-3 py-2 rounded-[3px]",
                "text-xs font-display font-semibold tracking-wide uppercase",
                "transition-colors duration-100",
                active
                  ? "bg-nyx-teal/10 text-nyx-teal"
                  : "text-nyx-3 hover:text-nyx-2 hover:bg-nyx-raised",
                collapsed && "justify-center px-0",
              )}
            >
              {/* Active bar */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-nyx-teal rounded-r-full" />
              )}
              <item.icon className={cn("shrink-0", collapsed ? "h-4 w-4" : "h-3.5 w-3.5")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* User + collapse */}
      <div className="border-t border-nyx-line">
        {/* User */}
        <Link
          to="/settings"
          onClick={onLinkClick}
          className={cn(
            "flex items-center gap-2.5 p-3 transition-colors hover:bg-nyx-raised",
            collapsed && "justify-center",
          )}
        >
          {user.image ? (
            <img src={user.image} alt="" className="h-6 w-6 rounded-full shrink-0 ring-1 ring-nyx-line" />
          ) : (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nyx-overlay text-[10px] font-display font-semibold text-nyx-2 ring-1 ring-nyx-line">
              {user.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
          )}
          {!collapsed && (
            <span className="truncate text-xs text-nyx-3 font-body">{user.name}</span>
          )}
        </Link>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={onToggle}
          className={cn(
            "hidden md:flex w-full items-center border-t border-nyx-line p-2.5",
            "text-nyx-3 hover:text-nyx-2 hover:bg-nyx-raised transition-colors",
            collapsed ? "justify-center" : "justify-end px-3",
          )}
        >
          <ChevronRight className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            !collapsed && "rotate-180",
          )} />
        </button>
      </div>
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose, user }: SidebarProps) {
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
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
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
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
