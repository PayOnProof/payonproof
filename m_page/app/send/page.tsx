"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { PopHeader } from "@/components/pop-header";
import { RemittanceForm } from "@/components/remittance-form";
import { RouteCard } from "@/components/route-card";
import { TransactionExecution } from "@/components/transaction-execution";
import { ProofOfPaymentView } from "@/components/proof-of-payment";
import type { RemittanceRoute, Transaction } from "@/lib/mock-data";
import { generateRoutes, COUNTRIES } from "@/lib/mock-data";
import { WalletProvider } from "@/lib/wallet-context";
import {
  ArrowLeft,
  BarChart3,
  TrendingDown,
  Timer,
  Zap,
  LayoutGrid,
  Rows3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppStep = "search" | "routes" | "execute" | "proof";

function SendPageContent() {
  const [step, setStep] = useState<AppStep>("search");
  const [routes, setRoutes] = useState<RemittanceRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RemittanceRoute | null>(
    null
  );
  const [amount, setAmount] = useState(0);
  const [originCode, setOriginCode] = useState("");
  const [destCode, setDestCode] = useState("");
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"recommended" | "cheapest" | "fastest">(
    "recommended"
  );
  const [viewMode, setViewMode] = useState<"cards" | "compact">("cards");

  const handleSearch = useCallback(
    (origin: string, destination: string, amt: number) => {
      setLoading(true);
      setOriginCode(origin);
      setDestCode(destination);
      setAmount(amt);

      setTimeout(() => {
        const results = generateRoutes(origin, destination, amt);
        setRoutes(results);
        setStep("routes");
        setLoading(false);
      }, 1200);
    },
    []
  );

  const handleSelectRoute = useCallback((route: RemittanceRoute) => {
    setSelectedRoute(route);
    setStep("execute");
  }, []);

  const handleTransactionComplete = useCallback((tx: Transaction) => {
    setTransaction(tx);
    setStep("proof");
  }, []);

  const handleNewTransfer = useCallback(() => {
    setStep("search");
    setRoutes([]);
    setSelectedRoute(null);
    setTransaction(null);
  }, []);

  const handleBackToRoutes = useCallback(() => {
    setSelectedRoute(null);
    setStep("routes");
  }, []);

  const originCountry = COUNTRIES.find((c) => c.code === originCode);
  const destCountry = COUNTRIES.find((c) => c.code === destCode);

  const sortedRoutes = [...routes].sort((a, b) => {
    if (sortBy === "cheapest") return a.feePercentage - b.feePercentage;
    if (sortBy === "fastest") return a.estimatedMinutes - b.estimatedMinutes;
    if (a.recommended) return -1;
    if (b.recommended) return 1;
    return a.feePercentage - b.feePercentage;
  });

  const sortOptions = [
    { value: "recommended", label: "Best", icon: BarChart3 },
    { value: "cheapest", label: "Cheapest", icon: TrendingDown },
    { value: "fastest", label: "Fastest", icon: Timer },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <PopHeader variant="app" />

      <main className="mx-auto max-w-5xl px-4 pb-20 pt-24">
        {/* ---- Step 1: Search Form ---- */}
        {step === "search" && (
          <div className="mx-auto max-w-md animate-fade-in-up">
            {/* Hero header */}
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="absolute -inset-4 rounded-full bg-primary/10 blur-2xl" />
                <Image
                  src="/isotipo.png"
                  alt="POP"
                  width={72}
                  height={72}
                  className="relative rounded-2xl"
                  priority
                />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
                Send Money Globally
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
                Compare routes, see real fees, and get verifiable proof of every
                payment — powered by Stellar.
              </p>
            </div>
            <RemittanceForm onSearch={handleSearch} loading={loading} />
          </div>
        )}

        {/* ---- Step 2: Route Comparison ---- */}
        {step === "routes" && (
          <div className="animate-fade-in-up">
            {/* Top bar: back, title, controls */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <Button
                  variant="ghost"
                  onClick={() => setStep("search")}
                  className="mb-2 gap-1.5 px-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
                  size="sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  New search
                </Button>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {routes.length} routes found
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {amount.toLocaleString()} {originCountry?.currency}
                  </span>{" "}
                  from {originCountry?.name} to {destCountry?.name}
                </p>
              </div>

              {/* Sort + view controls */}
              <div className="flex items-center gap-3">
                {/* Sort tabs */}
                <div className="flex rounded-xl border border-border bg-muted/20 p-1">
                  {sortOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = sortBy === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSortBy(opt.value)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold",
                          "transition-all duration-200",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* View toggle */}
                <div className="hidden rounded-xl border border-border bg-muted/20 p-1 sm:flex">
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    className={cn(
                      "rounded-lg p-2 transition-all duration-200",
                      viewMode === "cards"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="Card view"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("compact")}
                    className={cn(
                      "rounded-lg p-2 transition-all duration-200",
                      viewMode === "compact"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="Compact view"
                  >
                    <Rows3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Route comparison table (compact mode) */}
            {viewMode === "compact" && routes.length > 0 && (
              <div className="mb-6 overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Route
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Fee
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Rate
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Recipient Gets
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Escrow
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRoutes.map((route) => (
                      <tr
                        key={route.id}
                        className={cn(
                          "group border-b border-border transition-colors duration-150",
                          "hover:bg-primary/[0.03]",
                          route.recommended && "bg-primary/[0.02]",
                          !route.available && "opacity-40"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {route.recommended && (
                              <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />
                            )}
                            <span className="font-semibold text-foreground">
                              {route.originAnchor.name}
                            </span>
                            <span className="text-muted-foreground">{">"}</span>
                            <span className="font-semibold text-foreground">
                              {route.destinationAnchor.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold tabular-nums text-foreground">
                            {route.feePercentage}%
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({route.feeAmount.toFixed(1)})
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {route.estimatedTime}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-foreground">
                          {route.exchangeRate}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold tabular-nums text-foreground">
                            {route.receivedAmount.toLocaleString()}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            {destCountry?.currency}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {route.escrow ? (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              Yes
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleSelectRoute(route)}
                            disabled={!route.available}
                            className={cn(
                              "rounded-lg text-xs font-bold",
                              "transition-all duration-200",
                              "hover:scale-105",
                              "active:scale-[0.98]",
                              route.recommended
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
                            )}
                          >
                            Select
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Route cards (card mode) */}
            {viewMode === "cards" && (
              <div className="flex flex-col gap-4">
                {sortedRoutes.map((route, i) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    onSelect={handleSelectRoute}
                    originCurrency={originCountry?.currency || "USD"}
                    destinationCurrency={destCountry?.currency || "MXN"}
                    index={i}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {routes.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
                  <Zap className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-xl font-bold text-foreground">
                  No routes found
                </p>
                <p className="text-sm text-muted-foreground">
                  Try a different origin or destination country.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setStep("search")}
                  className="mt-2 rounded-xl bg-transparent"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to search
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ---- Step 3: Execute Transfer ---- */}
        {step === "execute" && selectedRoute && (
          <div className="mx-auto max-w-lg animate-fade-in-up">
            <TransactionExecution
              route={selectedRoute}
              amount={amount}
              onBack={handleBackToRoutes}
              onComplete={handleTransactionComplete}
            />
          </div>
        )}

        {/* ---- Step 4: Proof of Payment ---- */}
        {step === "proof" && transaction && (
          <div className="mx-auto max-w-lg animate-fade-in-up">
            <ProofOfPaymentView
              transaction={transaction}
              onNewTransfer={handleNewTransfer}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-3 px-4">
          <Image
            src="/isotipo.png"
            alt="POP"
            width={16}
            height={16}
            className="rounded-sm opacity-40"
          />
          <p className="text-center text-xs text-muted-foreground">
            POP uses Stellar as invisible infrastructure. KYC and compliance are
            handled by anchors. This is an MVP demo.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function SendPage() {
  return (
    <WalletProvider>
      <SendPageContent />
    </WalletProvider>
  );
}
