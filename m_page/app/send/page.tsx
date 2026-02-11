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
import { ArrowLeft, BarChart3, Zap, TrendingDown, Timer } from "lucide-react";
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
  const [sortBy, setSortBy] = useState<
    "recommended" | "cheapest" | "fastest"
  >("recommended");

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

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-24">
        {/* Step: Search */}
        {step === "search" && (
          <div className="mx-auto max-w-md animate-fade-in-up">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="relative mb-5">
                <div className="absolute -inset-3 rounded-full bg-primary/10 blur-xl" />
                <Image
                  src="/isotipo.png"
                  alt="POP"
                  width={64}
                  height={64}
                  className="relative rounded-2xl"
                />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
                Send Money Globally
              </h1>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground text-pretty">
                Compare routes, see real fees, and get verifiable proof of every
                payment — powered by Stellar.
              </p>
            </div>
            <RemittanceForm onSearch={handleSearch} loading={loading} />
          </div>
        )}

        {/* Step: Routes */}
        {step === "routes" && (
          <div className="animate-fade-in-up">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Button
                  variant="ghost"
                  onClick={() => setStep("search")}
                  className="mb-2 gap-1.5 px-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
                  size="sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <h1 className="text-2xl font-bold text-foreground">
                  {routes.length} routes found
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {amount.toLocaleString()} {originCountry?.currency} from{" "}
                  {originCountry?.name} to {destCountry?.name}
                </p>
              </div>

              {/* Sort tabs */}
              <div className="flex rounded-xl border border-border bg-muted/30 p-1">
                {sortOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = sortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSortBy(opt.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium",
                        "transition-all duration-200",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Route cards */}
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

            {routes.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <Zap className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold text-foreground">
                  No routes found
                </p>
                <p className="text-sm text-muted-foreground">
                  Try a different origin or destination country.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step: Execute */}
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

        {/* Step: Proof of Payment */}
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
            className="rounded-sm opacity-50"
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
