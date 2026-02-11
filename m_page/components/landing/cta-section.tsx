"use client";

import { ArrowRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnimateOnScroll } from "@/hooks/use-animate-on-scroll";
import { useWallet } from "@/lib/wallet-context";
import { useState } from "react";
import { ConnectWalletModal } from "@/components/connect-wallet-modal";

export function CtaSection() {
  const { ref, isVisible } = useAnimateOnScroll<HTMLElement>();
  const { status } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <section
        ref={ref}
        id="cta"
        className="border-t border-border px-4 py-20 md:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div
            className={cn(
              "relative overflow-hidden flex flex-col items-center rounded-3xl bg-gradient-to-br from-primary to-purple-700 px-6 py-16 text-center md:px-12",
              "transition-all duration-700",
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            )}
          >
            {/* Decorative glow */}
            <div
              className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-white/5 blur-3xl"
              aria-hidden="true"
            />

            <h2 className="relative max-w-lg text-balance text-3xl font-bold text-primary-foreground md:text-4xl">
              Stop overpaying for international transfers
            </h2>
            <p className="relative mt-4 max-w-md text-pretty text-sm leading-relaxed text-primary-foreground/70 md:text-base">
              Compare routes, send with confidence, and get verifiable proof for
              every payment. Start in under a minute.
            </p>

            {status === "connected" ? (
              <button
                onClick={() => {
                  const target = document.querySelector("#how-it-works");
                  if (target) {
                    const top =
                      target.getBoundingClientRect().top + window.scrollY - 80;
                    window.scrollTo({ top, behavior: "smooth" });
                  }
                }}
                className={cn(
                  "relative mt-8 flex items-center gap-2 rounded-xl px-8 py-3.5",
                  "bg-background text-foreground font-semibold",
                  "transition-all duration-200",
                  "hover:scale-105 hover:shadow-xl",
                  "active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                Start Sending
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setModalOpen(true)}
                className={cn(
                  "relative mt-8 flex items-center gap-2 rounded-xl px-8 py-3.5",
                  "bg-background text-foreground font-semibold",
                  "transition-all duration-200",
                  "hover:scale-105 hover:shadow-xl",
                  "active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet to Start
              </button>
            )}
          </div>
        </div>
      </section>

      <ConnectWalletModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
