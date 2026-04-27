import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, LayoutTemplate, Film, MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/cn";

const ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Templates", href: "/templates", icon: LayoutTemplate },
  { label: "Jobs", href: "/jobs", icon: Film },
  { label: "Menu", href: "/settings", icon: MoreHorizontal },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-nyx-border bg-nyx-deep md:hidden">
      <div className="flex h-16 items-center justify-around">
        {ITEMS.map((item) => {
          const active = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 text-[10px] transition-colors",
                active
                  ? "text-nyx-cyan-500"
                  : "text-nyx-text-muted hover:text-nyx-text-secondary",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
