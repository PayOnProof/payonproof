export function Footer() {
  return (
    <footer className="border-t border-border px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <span className="text-xs font-black text-primary-foreground">
              P
            </span>
          </div>
          <span className="text-sm font-semibold text-foreground">POP</span>
        </div>

        <div className="flex flex-col items-center gap-1 text-center md:flex-row md:gap-4">
          <p className="text-xs text-muted-foreground">
            POP is not a wallet, bank, or financial intermediary. It
            orchestrates anchors and routes.
          </p>
          <span className="hidden text-xs text-muted-foreground md:inline">
            |
          </span>
          <p className="text-xs text-muted-foreground">
            KYC and compliance are handled by participating anchors.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">MVP Demo</p>
      </div>
    </footer>
  );
}
