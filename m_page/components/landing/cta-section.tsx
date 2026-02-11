"use client";

import { ArrowRight, Wallet, Globe, Check, Shield, Fingerprint, Lock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAnimateOnScroll } from "@/hooks/use-animate-on-scroll";
import { useWallet } from "@/lib/wallet-context";
import { useState } from "react";
import { ConnectWalletModal } from "@/components/connect-wallet-modal";

const BADGES = [
  { icon: Check, label: "No hidden fees" },
  { icon: Check, label: "Under 5 minutes" },
  { icon: Check, label: "100% verified" },
];

const CERTIFICATIONS = [
  { icon: Shield, label: "Stellar Certified" },
  { icon: Fingerprint, label: "KYC via Anchors" },
  { icon: Lock, label: "End-to-End Encrypted" },
];

export function CtaSection() {
  const { ref, isVisible } = useAnimateOnScroll<HTMLElement>();
  const { status } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <section
        ref={ref}
        id="cta"
        className="relative overflow-hidden border-t border-border/30 px-4 py-28 md:py-36"
      >
        <div className="pointer-events-none absolute inset-0 dot-pattern opacity-20" aria-hidden="true" />

        <div className="relative mx-auto max-w-5xl">
          {/* Main CTA card */}
          <div
            className={cn(
              "relative overflow-hidden flex flex-col items-center rounded-3xl",
              "bg-gradient-to-br from-[#8B5CF6] via-[#7C3AED] to-[#6366F1]",
              "border border-white/10",
              "px-8 py-20 text-center md:px-20 md:py-24",
              "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "hover:-translate-y-2 hover:shadow-[0_32px_80px_rgba(139,92,246,0.35)]",
              isVisible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-10 scale-[0.96]"
            )}
          >
            {/* Overlays */}
            <div className="pointer-events-none absolute inset-0 dot-pattern opacity-30" aria-hidden="true" />
            <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-white/[0.06] blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-white/[0.04] blur-3xl" aria-hidden="true" />

            {/* Icon */}
            <div
              className={cn(
                "relative mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20",
                "transition-all duration-700",
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
              )}
              style={{ transitionDelay: isVisible ? "200ms" : "0ms" }}
            >
              <Globe className="h-8 w-8 text-white" />
            </div>

            {/* Title */}
            <h2
              className={cn(
                "relative max-w-xl text-balance text-3xl font-bold text-white md:text-4xl lg:text-5xl leading-[1.1]",
                "transition-all duration-700",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
              style={{ transitionDelay: isVisible ? "300ms" : "0ms" }}
            >
              Stop overpaying for international transfers
            </h2>

            {/* Description */}
            <p
              className={cn(
                "relative mt-5 max-w-md text-pretty text-white/70 leading-relaxed md:text-lg",
                "transition-all duration-700",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
              style={{ transitionDelay: isVisible ? "400ms" : "0ms" }}
            >
              Compare routes, send with confidence, and get verifiable proof for
              every payment.
            </p>

            {/* CTA Button */}
            <div
              className={cn(
                "relative mt-10 transition-all duration-700",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
              style={{ transitionDelay: isVisible ? "500ms" : "0ms" }}
            >
              {status === "connected" ? (
                <Link
                  href="/send"
                  className={cn(
                    "group inline-flex items-center gap-2.5 rounded-xl px-9 py-4",
                    "bg-white text-[#7C3AED] font-semibold text-base",
                    "transition-all duration-300",
                    "hover:bg-white/95 hover:scale-[1.04]",
                    "hover:shadow-[0_12px_32px_rgba(0,0,0,0.2)]",
                    "active:scale-[0.98]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#8B5CF6]"
                  )}
                >
                  Start Sending
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-xl px-9 py-4",
                    "bg-white text-[#7C3AED] font-semibold text-base",
                    "transition-all duration-300",
                    "hover:bg-white/95 hover:scale-[1.04]",
                    "hover:shadow-[0_12px_32px_rgba(0,0,0,0.2)]",
                    "active:scale-[0.98]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  )}
                >
                  <Wallet className="h-4 w-4" />
                  Connect Wallet to Start
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              )}
            </div>

            {/* Feature badges */}
            <div
              className={cn(
                "relative mt-10 flex flex-wrap items-center justify-center gap-6",
                "transition-all duration-700",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
              style={{ transitionDelay: isVisible ? "650ms" : "0ms" }}
            >
              {BADGES.map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex items-center gap-2 text-sm font-medium text-white/80"
                >
                  <badge.icon className="h-4 w-4 text-white/90" />
                  {badge.label}
                </span>
              ))}
            </div>
          </div>

          {/* Certification badges below the card */}
          <div
            className={cn(
              "mt-12 flex flex-col items-center gap-6 transition-all duration-700",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}
            style={{ transitionDelay: isVisible ? "800ms" : "0ms" }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Security & compliance
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {CERTIFICATIONS.map((cert) => (
                <div
                  key={cert.label}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-full border border-border/40 bg-card/40 backdrop-blur-sm px-5 py-2.5",
                    "transition-all duration-300",
                    "hover:border-primary/30 hover:bg-primary/[0.04]"
                  )}
                >
                  <cert.icon className="h-4 w-4 text-primary/70 transition-colors group-hover:text-primary" />
                  <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                    {cert.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ConnectWalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
