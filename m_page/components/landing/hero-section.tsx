"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Shield, Zap, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───── Animated counter ───── */
function useCountUp(end: number, duration = 1200, delay = 1500) {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      const s = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - s) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(eased * end));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [end, duration, delay]);
  return value;
}

/* ───── Ripple ───── */
function addRipple(e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = e.clientX - rect.left - size / 2;
  const y = e.clientY - rect.top - size / 2;
  const span = document.createElement("span");
  span.className = "ripple";
  span.style.width = span.style.height = `${size}px`;
  span.style.left = `${x}px`;
  span.style.top = `${y}px`;
  el.appendChild(span);
  setTimeout(() => span.remove(), 600);
}

/* ───── Parallax hook ───── */
function useParallax(speed = 0.5) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const handler = () => setOffset(window.scrollY * speed);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [speed]);
  return offset;
}

const PARTNERS = [
  "Stellar Network",
  "MoneyGram",
  "Circle (USDC)",
  "Tempo",
  "Settle Network",
  "Bitso",
  "Flutterwave",
  "AnchorUSD",
];

/* ───── Component ───── */
export function HeroSection() {
  const countries = useCountUp(12, 1200, 1500);
  const proofs = useCountUp(100, 1200, 1500);
  const transfers = useCountUp(50, 1200, 1500);
  const parallax = useParallax(0.35);

  const scrollToSection = useCallback(() => {
    const target = document.querySelector("#how-it-works");
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-28 pb-16">
      {/* ── Background: parallax orbs + grid ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div
          className="absolute -top-32 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-[#8B5CF6]/[0.07] blur-[140px] animate-float-slow"
          style={{ transform: `translate(-50%, ${-parallax * 0.5}px)` }}
        />
        <div
          className="absolute bottom-[-10%] right-[-8%] h-[500px] w-[500px] rounded-full bg-[#8B5CF6]/[0.04] blur-[120px] animate-float-slower"
          style={{ transform: `translateY(${parallax * 0.3}px)` }}
        />
        <div
          className="absolute top-[20%] left-[-5%] h-[300px] w-[300px] rounded-full bg-[#6366F1]/[0.04] blur-[100px] animate-float-slower"
          style={{ transform: `translateY(${-parallax * 0.2}px)` }}
        />
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="hero-badge mb-8 inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/[0.08] px-5 py-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Powered by Stellar Network
          </span>
        </div>

        {/* Heading */}
        <h1 className="mb-6 leading-[1.08] tracking-tight">
          <span className="hero-title block text-4xl font-bold text-foreground sm:text-5xl md:text-6xl lg:text-[4.25rem]">
            International Transfers.
          </span>
          <span className="hero-subtitle mt-2 block text-4xl font-bold bg-gradient-to-r from-[#8B5CF6] via-[#A78BFA] to-[#7C3AED] bg-clip-text text-transparent sm:text-5xl md:text-6xl lg:text-[4.25rem]">
            Proven On-Chain.
          </span>
        </h1>

        {/* Description */}
        <p className="hero-desc mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty md:text-xl">
          POP compares remittance routes across the Americas, executes transfers
          via the Stellar network, and generates a verifiable Proof of Payment
          for every transaction.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/send"
            onClick={(e) => addRipple(e)}
            className={cn(
              "hero-btn-1 ripple-container btn-shimmer group inline-flex items-center gap-2.5 rounded-xl px-8 py-4",
              "bg-primary text-primary-foreground font-semibold text-base",
              "transition-all duration-300",
              "hover:scale-[1.04] hover:-translate-y-0.5",
              "hover:shadow-[0_12px_32px_rgba(139,92,246,0.45)]",
              "active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            Start Sending
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <button
            type="button"
            onClick={scrollToSection}
            className={cn(
              "hero-btn-2 inline-flex items-center gap-2 rounded-xl border border-border/70 px-8 py-4",
              "text-foreground font-semibold text-base bg-transparent",
              "transition-all duration-300",
              "hover:border-primary/40 hover:bg-[rgba(139,92,246,0.06)] hover:scale-[1.03] hover:-translate-y-0.5",
              "hover:shadow-[0_6px_20px_rgba(139,92,246,0.12)]",
              "active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            How It Works
          </button>
        </div>

        {/* Stats row */}
        <div className="hero-stats mt-20 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            { icon: Globe, label: "Countries", value: `${countries}+`, suffix: "" },
            { icon: Zap, label: "Avg. Transfer", value: "< 5", suffix: " min", isStatic: true },
            { icon: Shield, label: "Verified Proofs", value: `${proofs}`, suffix: "%" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "group flex flex-col items-center gap-3 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm px-6 py-7",
                "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "hover:border-primary/30 hover:bg-primary/[0.04] hover:-translate-y-1.5",
                "hover:shadow-[0_16px_40px_rgba(139,92,246,0.12)]"
              )}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-all duration-300 group-hover:bg-primary group-hover:scale-110 group-hover:shadow-md group-hover:shadow-primary/25">
                <stat.icon className="h-5 w-5 text-primary transition-colors duration-300 group-hover:text-primary-foreground" />
              </div>
              <span className="text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
                {stat.isStatic ? stat.value : stat.value}
                <span className="text-xl text-muted-foreground">{stat.suffix}</span>
              </span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Partner logos marquee */}
        <div className="hero-partners mt-20">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Trusted by leading payment networks
          </p>
          <div className="relative overflow-hidden rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm py-5">
            {/* Fade edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />
            <div className="animate-scroll-logos flex w-max items-center gap-12">
              {[...PARTNERS, ...PARTNERS].map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                >
                  <Lock className="h-3.5 w-3.5" />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
