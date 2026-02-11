"use client";

import { ArrowDown, Shield, Zap, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export function HeroSection() {
  const scrollToSection = () => {
    const target = document.querySelector("#how-it-works");
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-20">
      {/* Background gradient orbs */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 animate-fade-in-up">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-primary">
            Powered by Stellar Network
          </span>
        </div>

        {/* Heading */}
        <h1
          className="mb-6 text-4xl font-bold leading-tight tracking-tight text-foreground text-balance sm:text-5xl md:text-6xl lg:text-7xl animate-fade-in-up stagger-1"
          style={{ opacity: 0 }}
        >
          Send Money Globally.{" "}
          <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            Prove It Instantly.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed text-pretty animate-fade-in-up stagger-2"
          style={{ opacity: 0 }}
        >
          POP compares remittance routes, executes transfers via the Stellar
          network, and generates verifiable Proof of Payment — all in one
          seamless flow.
        </p>

        {/* CTA Buttons */}
        <div
          className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center animate-fade-in-up stagger-3"
          style={{ opacity: 0 }}
        >
          <button
            onClick={scrollToSection}
            className={cn(
              "ripple-container flex items-center gap-2 rounded-xl px-8 py-3.5",
              "bg-primary text-primary-foreground font-semibold text-base",
              "transition-all duration-200",
              "hover:scale-105 hover:shadow-xl hover:shadow-primary/30",
              "active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            Get Started
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            onClick={scrollToSection}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-border px-8 py-3.5",
              "text-foreground font-semibold text-base",
              "transition-all duration-200",
              "hover:border-primary/50 hover:bg-primary/5 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10",
              "active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            Learn More
          </button>
        </div>

        {/* Stats row */}
        <div
          className="mt-16 grid grid-cols-3 gap-6 sm:gap-8 animate-fade-in-up stagger-4"
          style={{ opacity: 0 }}
        >
          {[
            { icon: Globe, label: "Countries", value: "180+" },
            { icon: Zap, label: "Avg. Transfer", value: "< 5 min" },
            { icon: Shield, label: "Verified Proofs", value: "100%" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-2xl font-bold text-foreground sm:text-3xl">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground sm:text-sm">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
