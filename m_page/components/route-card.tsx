"use client";

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
    label: "Operational",
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
        "group overflow-hidden border transition-all duration-300",
        "hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5",
        route.recommended
          ? "border-primary/40 ring-1 ring-primary/20 bg-primary/[0.02]"
          : "border-border",
        !route.available && "opacity-50 pointer-events-none"
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Recommended tag */}
      {route.recommended && (
        <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/5 px-5 py-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Recommended Route
          </span>
        </div>
      )}

      <div className="p-5">
        {/* Top row: Anchors, badges */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-1 flex-col gap-3">
            {/* Anchor pathway */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5">
                <CircleDot className="h-3.5 w-3.5 text-primary" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">
                    {route.originAnchor.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {route.originAnchor.country} / {route.originAnchor.currency}
                  </span>
                </div>
              </div>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5">
                <CircleDot className="h-3.5 w-3.5 text-success" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">
                    {route.destinationAnchor.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {route.destinationAnchor.country} / {route.destinationAnchor.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("gap-1 text-[10px]", originStatus.className)}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", originStatus.dot)} />
                Origin: {originStatus.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn("gap-1 text-[10px]", destStatus.className)}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", destStatus.dot)} />
                Dest: {destStatus.label}
              </Badge>
              {route.escrow && (
                <Badge variant="outline" className="gap-1 text-[10px] border-primary/30 text-primary bg-primary/5">
                  <Shield className="h-3 w-3" />
                  Escrow
                </Badge>
              )}
            </div>

            {/* Key metrics row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{route.estimatedTime}</span>
              </span>
              <span className="text-muted-foreground">
                Fee:{" "}
                <span className="font-medium text-foreground">
                  {route.feePercentage}%
                </span>{" "}
                <span className="text-xs">
                  ({route.feeAmount.toFixed(2)} {originCurrency})
                </span>
              </span>
              <span className="text-muted-foreground">
                Rate:{" "}
                <span className="font-medium text-foreground">
                  1 {originCurrency} = {route.exchangeRate} {destinationCurrency}
                </span>
              </span>
            </div>
          </div>

          {/* Amount + CTA */}
          <div className="flex items-center gap-4 md:flex-col md:items-end md:gap-2">
            <div className="md:text-right">
              <p className="text-xs text-muted-foreground">Recipient gets</p>
              <p className="text-2xl font-bold text-foreground">
                {route.receivedAmount.toLocaleString()}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {destinationCurrency}
                </span>
              </p>
            </div>
            <Button
              onClick={() => onSelect(route)}
              disabled={!route.available}
              className={cn(
                "min-w-[120px] rounded-xl font-semibold",
                "transition-all duration-200",
                "hover:scale-105 hover:shadow-lg hover:shadow-primary/20",
                "active:scale-[0.98]",
                route.recommended
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
              )}
            >
              Select Route
            </Button>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-muted-foreground",
            "transition-all duration-200",
            "hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <Activity className="h-3 w-3" />
          {expanded ? "Hide details" : "Show fee breakdown, risks & details"}
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-2 animate-fade-in-up rounded-xl border border-border bg-muted/20 p-4">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {/* Fee breakdown */}
              <div>
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Activity className="h-3 w-3" />
                  Fee Breakdown
                </h4>
                <div className="flex flex-col gap-2.5">
                  <FeeRow
                    label="On-ramp"
                    value={route.feeBreakdown.onRamp}
                    total={route.feePercentage}
                  />
                  <FeeRow
                    label="Bridge (Stellar)"
                    value={route.feeBreakdown.bridge}
                    total={route.feePercentage}
                  />
                  <FeeRow
                    label="Off-ramp"
                    value={route.feeBreakdown.offRamp}
                    total={route.feePercentage}
                  />
                  <div className="mt-1 flex justify-between border-t border-border pt-2 text-sm font-semibold">
                    <span className="text-foreground">Total</span>
                    <span className="text-primary">{route.feePercentage}%</span>
                  </div>
                </div>
              </div>

              {/* Service availability */}
              <div>
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  Service Details
                </h4>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Availability</span>
                    <span className={cn("font-medium", route.available ? "text-success" : "text-destructive")}>
                      {route.available ? "Available" : "Unavailable"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Escrow</span>
                    <span className={cn("font-medium", route.escrow ? "text-primary" : "text-muted-foreground")}>
                      {route.escrow ? "Protected" : "No escrow"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Settlement</span>
                    <span className="font-medium text-foreground">{route.estimatedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Corridor</span>
                    <span className="font-medium text-foreground">
                      {route.originCountry} &rarr; {route.destinationCountry}
                    </span>
                  </div>
                </div>
              </div>

              {/* Risks */}
              <div>
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" />
                  Risks & Limitations
                </h4>
                {route.risks.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {route.risks.map((risk) => (
                      <li
                        key={risk}
                        className="flex items-start gap-2 rounded-lg bg-warning/5 p-2 text-xs text-muted-foreground"
                      >
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg bg-success/5 p-3 text-xs text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    No known risks for this route
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

function FeeRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}%</span>
      </div>
      <Progress value={percentage} className="h-1.5" />
    </div>
  );
}
