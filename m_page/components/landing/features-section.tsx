"use client";

import {
  Eye,
  Shield,
  Zap,
  DollarSign,
  Globe,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnimateOnScroll } from "@/hooks/use-animate-on-scroll";

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
    title: "Multi-Corridor",
    description:
      "Support for multiple countries and currencies. Send from the US to Mexico, Colombia, Nigeria, and more.",
  },
  {
    icon: FileText,
    title: "Proof of Payment",
    description:
      "Every transfer generates a verifiable, portable POP document you can share with anyone.",
  },
];

export function FeaturesSection() {
  const { ref, isVisible } = useAnimateOnScroll<HTMLElement>();

  return (
    <section
      ref={ref}
      id="features"
      className="border-t border-border bg-card/30 px-4 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div
          className={cn(
            "mb-14 text-center transition-all duration-700",
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          )}
        >
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Built for Trust & Speed
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-muted-foreground leading-relaxed">
            POP orchestrates anchors, routes, and verification so you can focus
            on sending money, not understanding infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className={cn(
                "group rounded-2xl border border-border bg-card p-6",
                "transition-all duration-500",
                "hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10",
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              )}
              style={{
                transitionDelay: isVisible ? `${i * 100}ms` : "0ms",
              }}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
