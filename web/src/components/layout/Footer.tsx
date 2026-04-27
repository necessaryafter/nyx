const COLUMNS = [
  {
    title: "Produto",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Docs", href: "#" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Termos", href: "#" },
      { label: "Privacidade", href: "#" },
    ],
  },
  {
    title: "Social",
    links: [
      { label: "Twitter", href: "#" },
      { label: "Discord", href: "#" },
      { label: "GitHub", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-nyx-border">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-col justify-between md:flex-row">
          {/* Brand */}
          <div className="mb-8 md:mb-0">
            <span className="font-logo text-lg tracking-[0.2em] text-nyx-text-primary">
              NYX
            </span>
            <p className="mt-2 text-sm text-nyx-text-muted">
              Configure once. Produce forever.
            </p>
            <p className="mt-4 text-xs text-nyx-text-muted">
              &copy; {new Date().getFullYear()} Nyx. Todos os direitos reservados.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-medium uppercase tracking-wider text-nyx-text-muted">
                  {col.title}
                </h4>
                <ul className="mt-3 space-y-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-nyx-text-muted transition-colors hover:text-nyx-text-primary"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Large brand name */}
        <div className="mt-12 flex w-full items-center justify-center">
          <span className="select-none bg-gradient-to-b from-nyx-text-muted/40 to-nyx-void bg-clip-text font-logo text-[6rem] leading-none tracking-[0.3em] text-transparent md:text-[10rem]">
            NYX
          </span>
        </div>
      </div>
    </footer>
  );
}
