import { useState, useEffect } from "react";
import { Menu, X, Sun, Moon, Monitor } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import { useTheme } from "../../lib/useTheme";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Como funciona", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

const THEME_META = {
  system: { icon: Monitor, label: "Tema: Sistema" },
  light: { icon: Sun, label: "Tema: Claro" },
  dark: { icon: Moon, label: "Tema: Escuro" },
} as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, cycleTheme } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ThemeIcon = THEME_META[theme].icon;

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full bg-nyx-void/80 backdrop-blur-md transition-[border-color] duration-200",
        scrolled ? "border-b border-nyx-border" : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link to="/" className="font-logo text-xl tracking-[0.2em] text-nyx-text-primary">
          NYX
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-nyx-text-muted transition-colors hover:text-nyx-text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button
            onClick={cycleTheme}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-nyx-text-muted transition-colors hover:bg-nyx-hover hover:text-nyx-text-primary"
            aria-label={THEME_META[theme].label}
            title={THEME_META[theme].label}
          >
            <ThemeIcon className="h-4 w-4" />
          </button>
          <Link to="/login">
            <Button variant="ghost" size="sm">Login</Button>
          </Link>
          <Link to="/register">
            <Button size="sm">Comece gratis</Button>
          </Link>
        </div>

        <button
          className="text-nyx-text-muted md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-nyx-border bg-nyx-void md:hidden"
          >
            <div className="flex flex-col gap-4 px-6 py-5">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-nyx-text-muted transition-colors hover:text-nyx-text-primary"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={cycleTheme}
                  className="flex cursor-pointer items-center gap-2 py-2 text-sm text-nyx-text-muted transition-colors hover:text-nyx-text-primary"
                >
                  <ThemeIcon className="h-4 w-4" />
                  {THEME_META[theme].label}
                </button>
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" size="md" className="w-full">Login</Button>
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)}>
                  <Button size="md" className="w-full">Comece gratis</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
