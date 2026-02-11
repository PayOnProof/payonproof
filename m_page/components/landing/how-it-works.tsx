"use client";

import { Search, GitCompareArrows, Send, FileCheck, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnimateOnScroll } from "@/hooks/use-animate-on-scroll";

const STEPS = [
  {
    icon: Search,
    number: "01",
    title: "Enter Details",
    description:
      "Select your origin country, destination, and amount. POP instantly queries all available anchor routes.",
    color: "from-[#8B5CF6] to-[#7C3AED]",
  },
  {
    icon: GitCompareArrows,
    number: "02",
    title: "Compare Routes",
    description:
      "Side-by-side comparison of fees, settlement speed, escrow options, and anchor operational status.",
    color: "from-[#A78BFA] to-[#8B5CF6]",
  },
  {
    icon: Send,
    number: "03",
    title: "Execute Transfer",
    description:
      "One click to execute. Optional escrow protection secures funds through every leg of the journey.",
    color: "from-[#7C3AED] to-[#6366F1]",
  },
  {
    icon: FileCheck,
    number: "04",
    title: "Receive Proof",
    description:
      "A verifiable, portable Proof of Payment is generated on-chain. Share it with anyone, anywhere.",
    color: "from-[#6366F1] to-[#8B5CF6]",
  },
];

export function HowItWorks() {
  const { ref, isVisible } = useAnimateOnScroll<HTMLElement>();

  return (
    <section
      ref={ref}
      id="how-it-works"
      className="relative overflow-hidden border-t border-border/30 px-4 py-28 md:py-36"
    >
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 dot-pattern opacity-30" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl">
        {/* Header */}
        <div
          className={cn(
            "mb-20 text-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            How It Works
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            Four steps to transparent
            <br className="hidden sm:block" />
            <span className="text-primary">{" "}global transfers</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-muted-foreground leading-relaxed">
            From route comparison to verifiable proof, every step is designed
            for clarity, speed, and trust.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div key={step.number} className="relative flex">
              {/* Arrow connector on desktop (between cards) */}
              {i < STEPS.length - 1 && (
                <div className="pointer-events-none absolute -right-3 top-1/2 z-20 hidden -translate-y-1/2 lg:block">
                  <ChevronRight className="h-5 w-5 text-primary/40" />
                </div>
              )}

              <div
                className={cn(
                  "group relative flex w-full flex-col rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-7",
                  "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "hover:border-primary/30 hover:bg-primary/[0.04] hover:-translate-y-2",
                  "hover:shadow-[0_20px_50px_rgba(139,92,246,0.12)]",
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
                )}
                style={{ transitionDelay: isVisible ? `${i * 150}ms` : "0ms" }}
              >
                {/* Step number badge */}
                <div className="mb-5 flex items-center justify-between">
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-primary-foreground",
                    "transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/25",
                    step.color
                  )}>
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-sm font-bold text-muted-foreground/40">
                    {step.number}
                  </span>
                </div>

                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Inline CTA */}
        <div
          className={cn(
            "mt-14 flex justify-center transition-all duration-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
          style={{ transitionDelay: isVisible ? "700ms" : "0ms" }}
        >
          <a
            href="/send"
            className={cn(
              "group inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.06] px-6 py-3",
              "text-sm font-semibold text-primary",
              "transition-all duration-300",
              "hover:bg-primary/[0.12] hover:border-primary/50 hover:shadow-md hover:shadow-primary/10"
            )}
          >
            Try it now
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </section>
  );
}
