"use client";

import React from "react"

import type { RemittanceRoute } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  Shield,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
  CircleDot,
  Activity,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface RouteCardProps {
  route: RemittanceRoute;
  onSelect: (route: RemittanceRoute) => void;
  originCurrency: string;
  destinationCurrency: string;
  index?: number;
}

const STATUS_CONFIG = {
  operational: {
    label: "Live",
    className: "bg-success/10 text-success border-success/20",
    dot: "bg-success",
  },
  degraded: {
    label: "Degraded",
    className: "bg-warning/10 text-warning border-warning/20",
    dot: "bg-warning",
  },
  offline: {
    label: "Offline",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
};

export function RouteCard({
  route,
  onSelect,
  originCurrency,
  destinationCurrency,
  index = 0,
}: RouteCardProps) {
  const [expanded, setExpanded] = useState(false);

  const originStatus = STATUS_CONFIG[route.originAnchor.status];
  const destStatus = STATUS_CONFIG[route.destinationAnchor.status];

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border transition-all duration-300",
        "hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1",
        route.recommended
          ? "border-primary/40 ring-1 ring-primary/20"
          : "border-border hover:border-primary/20",
        !route.available && "opacity-40 pointer-events-none"
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Recommended banner */}
      {route.recommended && (
        <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/5 px-5 py-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Best Route
          </span>
        </div>
      )}

      <div className="p-4 sm:p-5 md:p-6">
        {/* Main row: pathway + amount + CTA */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: anchor pathway + badges + metrics */}
          <div className="flex flex-1 flex-col gap-4">
            {/* Anchor pathway */}
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2 sm:w-auto sm:px-3.5">
                <CircleDot className="h-4 w-4 shrink-0 text-primary" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground">
                    {route.originAnchor.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {route.originAnchor.country} / {route.originAnchor.currency}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-1 gap-1 text-[9px] px-1.5 py-0",
                    originStatus.className
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      originStatus.dot
                    )}
                  />
                  {originStatus.label}
                </Badge>
              </div>

              <div className="ml-4 flex h-6 w-6 items-center justify-center rounded-full bg-muted/50 sm:ml-0 sm:h-8 sm:w-8">
                <ArrowRight className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5" />
              </div>

              <div className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2 sm:w-auto sm:px-3.5">
                <CircleDot className="h-4 w-4 shrink-0 text-success" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground">
                    {route.destinationAnchor.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {route.destinationAnchor.country} /{" "}
                    {route.destinationAnchor.currency}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-1 gap-1 text-[9px] px-1.5 py-0",
                    destStatus.className
                  )}
                >
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", destStatus.dot)}
                  />
                  {destStatus.label}
                </Badge>
              </div>
            </div>

            {/* Key metric pills */}
            <div className="flex flex-wrap items-center gap-2">
              <MetricPill
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Time"
                value={route.estimatedTime}
              />
              <MetricPill
                icon={<Activity className="h-3.5 w-3.5" />}
                label="Fee"
                value={`${route.feePercentage}%`}
                sublabel={`${route.feeAmount.toFixed(2)} ${originCurrency}`}
              />
              <MetricPill
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Rate"
                value={`${route.exchangeRate}`}
                sublabel={`${originCurrency}/${destinationCurrency}`}
              />
              {route.escrow && (
                <div className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">
                    Escrow
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: received amount + CTA */}
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5 lg:flex-col lg:items-end lg:gap-3">
            <div className="lg:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recipient gets
              </p>
              <p className="text-3xl font-bold tabular-nums text-foreground lg:text-2xl">
                {route.receivedAmount.toLocaleString()}
                <span className="ml-1.5 text-sm font-medium text-muted-foreground">
                  {destinationCurrency}
                </span>
              </p>
            </div>
            <Button
              onClick={() => onSelect(route)}
              disabled={!route.available}
              className={cn(
                "w-full min-w-[130px] rounded-xl font-bold sm:w-auto",
                "transition-all duration-200",
                "hover:scale-105 hover:shadow-lg hover:shadow-primary/20",
                "active:scale-[0.98]",
                route.recommended
                  ? "bg-primary text-primary-foreground glow-pulse"
                  : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
              )}
            >
              Select Route
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-medium text-muted-foreground",
            "transition-all duration-200",
            "hover:bg-muted/30 hover:text-foreground hover:border-primary/20"
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          {expanded
            ? "Hide details"
            : "Show fee breakdown, risks & service details"}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Expanded details panel */}
        {expanded && (
          <div className="mt-4 animate-fade-in-up rounded-xl border border-border bg-muted/10 p-5">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Fee breakdown */}
              <div>
                <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  Fee Breakdown
                </h4>
                <div className="flex flex-col gap-3">
                  <FeeRow
                    label="On-ramp"
                    description="Fiat deposit fee"
                    value={route.feeBreakdown.onRamp}
                    total={route.feePercentage}
                  />
                  <FeeRow
                    label="Bridge (Stellar)"
                    description="Network transfer fee"
                    value={route.feeBreakdown.bridge}
                    total={route.feePercentage}
                  />
                  <FeeRow
                    label="Off-ramp"
                    description="Fiat withdrawal fee"
                    value={route.feeBreakdown.offRamp}
                    total={route.feePercentage}
                  />
                  <div className="mt-1 flex justify-between border-t border-border pt-3">
                    <span className="text-sm font-bold text-foreground">
                      Total Fee
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-primary">
                        {route.feePercentage}%
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({route.feeAmount.toFixed(2)} {originCurrency})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service details */}
              <div>
                <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  Service Details
                </h4>
                <div className="flex flex-col gap-3">
                  <ServiceRow
                    label="Availability"
                    value={route.available ? "Available" : "Unavailable"}
                    valueClassName={
                      route.available ? "text-success" : "text-destructive"
                    }
                  />
                  <ServiceRow
                    label="Escrow"
                    value={route.escrow ? "Protected" : "No escrow"}
                    valueClassName={
                      route.escrow ? "text-primary" : "text-muted-foreground"
                    }
                  />
                  <ServiceRow
                    label="Settlement"
                    value={route.estimatedTime}
                  />
                  <ServiceRow
                    label="Corridor"
                    value={`${route.originCountry} \u2192 ${route.destinationCountry}`}
                  />
                  <ServiceRow
                    label="Origin Status"
                    value={originStatus.label}
                    valueClassName={
                      route.originAnchor.status === "operational"
                        ? "text-success"
                        : route.originAnchor.status === "degraded"
                          ? "text-warning"
                          : "text-destructive"
                    }
                  />
                  <ServiceRow
                    label="Dest. Status"
                    value={destStatus.label}
                    valueClassName={
                      route.destinationAnchor.status === "operational"
                        ? "text-success"
                        : route.destinationAnchor.status === "degraded"
                          ? "text-warning"
                          : "text-destructive"
                    }
                  />
                </div>
              </div>

              {/* Risks */}
              <div>
                <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  Risks & Limitations
                </h4>
                {route.risks.length > 0 ? (
                  <ul className="flex flex-col gap-2.5">
                    {route.risks.map((risk) => (
                      <li
                        key={risk}
                        className="flex items-start gap-2.5 rounded-lg border border-warning/10 bg-warning/5 p-3 text-xs leading-relaxed text-muted-foreground"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-lg border border-success/10 bg-success/5 p-4 text-xs text-success">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="font-medium">
                      No known risks for this route
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---- Sub-components ---- */

function MetricPill({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-xs font-bold text-foreground">{value}</span>
      {sublabel && (
        <span className="text-[10px] text-muted-foreground">{sublabel}</span>
      )}
    </div>
  );
}

function FeeRow({
  label,
  description,
  value,
  total,
}: {
  label: string;
  description: string;
  value: number;
  total: number;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground">
            {description}
          </span>
        </div>
        <span className="text-xs font-bold tabular-nums text-foreground">
          {value}%
        </span>
      </div>
      <Progress value={percentage} className="h-1.5" />
    </div>
  );
}

function ServiceRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium text-foreground", valueClassName)}>
        {value}
      </span>
    </div>
  );
}
