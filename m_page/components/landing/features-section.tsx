"use client";

import {
  Eye,
  Shield,
  Zap,
  DollarSign,
  Globe,
  FileText,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnimateOnScroll } from "@/hooks/use-animate-on-scroll";

/* ───── Feature data ───── */
const FEATURES = [
  {
    icon: Eye,
    title: "Full Transparency",
    description:
      "See every fee, spread, and cost before you send. No hidden charges, no surprises.",
  },
  {
    icon: Shield,
    title: "Escrow Protection",
    description:
      "Optional programmatic escrow secures funds during transit with clear, automated rules.",
  },
  {
    icon: Zap,
    title: "Stellar Powered",
    description:
      "Built on Stellar for fast, low-cost cross-border settlements. Blockchain stays invisible to you.",
  },
  {
    icon: DollarSign,
    title: "Best Rate Finder",
    description:
      "Automatically compares anchors and routes to find the most cost-effective path for your money.",
  },
  {
    icon: Globe,
    title: "Americas Coverage",
    description:
      "Full support from the US and Canada through Central America to every major South American economy.",
  },
  {
    icon: FileText,
    title: "Proof of Payment",
    description:
      "Every transfer generates a verifiable, portable POP document backed by on-chain data.",
  },
];

/* ───── Testimonial data ───── */
const TESTIMONIALS = [
  {
    quote:
      "POP gave us complete visibility into our cross-border payments. The Proof of Payment alone saved us hours of reconciliation each week.",
    author: "Maria Fernandez",
    role: "CFO, LatAm Imports Co.",
  },
  {
    quote:
      "The route comparison feature is a game changer. We reduced transfer costs by 40% in the first month by consistently picking the best corridor.",
    author: "James Chen",
    role: "Treasury Director, Pacific Trade Ltd.",
  },
  {
    quote:
      "Finally, a remittance platform that treats transparency as a feature, not an afterthought. Our compliance team loves the on-chain verification.",
    author: "Ana Lucia Restrepo",
    role: "Head of Compliance, Envios Rapidos",
  },
];

export function FeaturesSection() {
  const { ref: featRef, isVisible: featVisible } =
    useAnimateOnScroll<HTMLElement>();
  const { ref: testRef, isVisible: testVisible } =
    useAnimateOnScroll<HTMLDivElement>({ threshold: 0.15 });

  return (
    <section
      id="features"
      className="relative overflow-hidden border-t border-border/30 px-4 py-28 md:py-36"
    >
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0 grid-pattern opacity-30"
        aria-hidden="true"
      />

      {/* ── Features ── */}
      <div ref={featRef} className="relative mx-auto max-w-6xl">
        <div
          className={cn(
            "mb-20 text-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
            featVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          )}
        >
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Why POP
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            Built for <span className="text-primary">trust</span> and{" "}
            <span className="text-primary">speed</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-muted-foreground leading-relaxed">
            POP orchestrates anchors, routes, and verification so you can focus
            on sending money, not understanding infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className={cn(
                "group relative rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-7",
                "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "hover:border-primary/30 hover:bg-primary/[0.04] hover:-translate-y-2",
                "hover:shadow-[0_20px_50px_rgba(139,92,246,0.12)]",
                featVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-10"
              )}
              style={{
                transitionDelay: featVisible ? `${i * 150}ms` : "0ms",
              }}
            >
              {/* Icon */}
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/25">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Testimonials ── */}
      <div
        ref={testRef}
        className="relative mx-auto mt-28 max-w-6xl md:mt-36"
      >
        <div
          className={cn(
            "mb-16 text-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
            testVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          )}
        >
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Testimonials
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Trusted across the Americas
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <blockquote
              key={t.author}
              className={cn(
                "group relative flex flex-col rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-7",
                "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "hover:border-primary/20 hover:bg-primary/[0.03] hover:-translate-y-1",
                "hover:shadow-[0_12px_36px_rgba(139,92,246,0.08)]",
                testVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-10"
              )}
              style={{
                transitionDelay: testVisible ? `${i * 150}ms` : "0ms",
              }}
            >
              <Quote className="mb-4 h-6 w-6 text-primary/30" />
              <p className="mb-6 flex-1 text-sm leading-relaxed text-foreground/80 italic">
                {`"${t.quote}"`}
              </p>
              <footer className="border-t border-border/30 pt-4">
                <p className="text-sm font-semibold text-foreground">
                  {t.author}
                </p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
