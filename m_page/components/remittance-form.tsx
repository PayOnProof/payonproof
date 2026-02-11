"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { ArrowDownUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountrySelector } from "@/components/country-selector";
import { COUNTRIES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface RemittanceFormProps {
  onSearch: (origin: string, destination: string, amount: number) => void;
  loading: boolean;
}

export function RemittanceForm({ onSearch, loading }: RemittanceFormProps) {
  const [origin, setOrigin] = useState("US");
  const [destination, setDestination] = useState("MX");
  const [amount, setAmount] = useState("500");

  const originCountry = COUNTRIES.find((c) => c.code === origin);

  const handleSwap = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
  }, [origin, destination]);

  const handleSubmit = useCallback(() => {
    const numAmount = Number.parseFloat(amount);
    if (numAmount > 0 && origin && destination) {
      onSearch(origin, destination, numAmount);
    }
  }, [amount, origin, destination, onSearch]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-background/50">
      {/* Card Header */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-6 py-4">
        <Image
          src="/isotipo.png"
          alt="POP"
          width={28}
          height={28}
          className="rounded-md"
        />
        <div>
          <h2 className="text-lg font-bold text-foreground">Send Money</h2>
          <p className="text-xs text-muted-foreground">
            Compare the best routes for your international transfer
          </p>
        </div>
      </div>

      {/* Form Body */}
      <div className="flex flex-col gap-5 p-6">
        <CountrySelector
          value={origin}
          onValueChange={setOrigin}
          label="From"
          exclude={destination}
        />

        <div className="flex justify-center">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSwap}
            className={cn(
              "h-10 w-10 rounded-full border-border bg-transparent text-muted-foreground",
              "transition-all duration-200",
              "hover:rotate-180 hover:border-primary/50 hover:text-primary hover:shadow-md hover:shadow-primary/10",
              "active:scale-95"
            )}
            aria-label="Swap origin and destination"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        <CountrySelector
          value={destination}
          onValueChange={setDestination}
          label="To"
          exclude={origin}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Amount ({originCountry?.currency || "USD"})
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
              {originCountry?.currency === "USD" ? "$" : originCountry?.currency === "MXN" ? "$" : ""}
            </span>
            <Input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={cn(
                "h-14 rounded-xl border-border bg-muted/50 text-right text-2xl font-bold text-foreground",
                "transition-colors",
                "hover:bg-muted focus:bg-muted focus:ring-primary",
                "pr-20"
              )}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
              {originCountry?.currency || "USD"}
            </span>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!amount || Number.parseFloat(amount) <= 0 || loading}
          className={cn(
            "mt-1 h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground",
            "transition-all duration-200",
            "hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25",
            "active:scale-[0.98]",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
          )}
          size="lg"
        >
          {loading ? (
            <span className="flex items-center gap-3">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Comparing routes...
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <Search className="h-5 w-5" />
              Compare Routes
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
