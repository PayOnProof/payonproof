"use client";

import { Search, GitCompareArrows, Send, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnimateOnScroll } from "@/hooks/use-animate-on-scroll";

const STEPS = [
  {
    icon: Search,
    title: "Enter Transfer Details",
    description:
      "Select origin, destination, and the amount you want to send. POP handles the rest.",
  },
  {
    icon: GitCompareArrows,
    title: "Compare Routes",
    description:
      "See real-time comparisons of available routes with fees, settlement times, and risk indicators.",
  },
  {
    icon: Send,
    title: "Execute Transfer",
    description:
      "Select the best route and execute. Optional escrow protection secures your funds during transit.",
  },
  {
    icon: FileCheck,
    title: "Get Proof of Payment",
    description:
      "Receive a verifiable, shareable Proof of Payment backed by the Stellar blockchain.",
  },
];

export function HowItWorks() {
  const { ref, isVisible } = useAnimateOnScroll<HTMLElement>();

  return (
    <section
      ref={ref}
      id="how-it-works"
      className="border-t border-border px-4 py-20 md:py-28"
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
            How POP Works
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-muted-foreground leading-relaxed">
            Four simple steps to send money internationally with full
            transparency and verifiable proof.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className={cn(
                "group relative flex flex-col items-start rounded-2xl border border-border bg-card p-6",
                "transition-all duration-500",
                "hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10",
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              )}
              style={{
                transitionDelay: isVisible ? `${i * 150}ms` : "0ms",
              }}
            >
              {/* Step number */}
              <span className="absolute -top-3 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>

              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110">
                <step.icon className="h-6 w-6" />
              </div>

              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
