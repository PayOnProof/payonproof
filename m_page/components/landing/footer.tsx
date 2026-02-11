import Image from "next/image";

const LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Send Money", href: "/send" },
];

export function Footer() {
  return (
    <footer className="border-t border-border/30 px-4 py-12 md:py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        {/* Top row */}
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <Image
              src="/isotipo.png"
              alt="POP logo"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-base font-bold tracking-tight text-foreground">
              POP
            </span>
            <span className="ml-1 rounded-full border border-primary/20 bg-primary/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              MVP
            </span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6" aria-label="Footer navigation">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-border/30" />

        {/* Bottom row */}
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-xs leading-relaxed text-muted-foreground text-center md:text-left">
            POP is not a wallet, bank, or financial intermediary. It
            orchestrates anchors and routes. KYC and compliance are handled by
            participating anchors.
          </p>
          <p className="shrink-0 text-xs text-muted-foreground/60">
            2025 POP. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
