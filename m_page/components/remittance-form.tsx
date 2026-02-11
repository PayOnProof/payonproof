"use client";

import React from "react"

import { useState, useCallback } from "react";
import Image from "next/image";
import { ArrowDownUp, Search, Sparkles } from "lucide-react";
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
  const [destination, setDestination] = useState("CO");
  const [amount, setAmount] = useState("500");

  const originCountry = COUNTRIES.find((c) => c.code === origin);
  const parsedAmount = Number.parseFloat(amount) || 0;
  const isValid = parsedAmount > 0 && origin && destination && origin !== destination;

  const handleSwap = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
  }, [origin, destination]);

  const handleSubmit = useCallback(() => {
    if (isValid) {
      onSearch(origin, destination, parsedAmount);
    }
  }, [isValid, amount, origin, destination, onSearch, parsedAmount]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && isValid && !loading) {
        handleSubmit();
      }
    },
    [isValid, loading, handleSubmit]
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
      {/* Card Header */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-6 py-5">
        <div className="relative">
          <div className="absolute -inset-1 rounded-xl bg-primary/20 blur-md" />
          <Image
            src="/isotipo.png"
            alt="POP"
            width={32}
            height={32}
            className="relative rounded-lg"
          />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Send Money
          </h2>
          <p className="text-xs text-muted-foreground">
            Compare the best routes for your transfer
          </p>
        </div>
      </div>

      {/* Form Body */}
      <div className="flex flex-col gap-5 p-6" onKeyDown={handleKeyDown}>
        {/* Origin country */}
        <CountrySelector
          value={origin}
          onValueChange={setOrigin}
          label="From"
          exclude={destination}
        />

        {/* Swap button */}
        <div className="flex justify-center -my-1">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSwap}
            className={cn(
              "h-10 w-10 rounded-full border-border bg-transparent text-muted-foreground",
              "transition-all duration-300",
              "hover:rotate-180 hover:border-primary/50 hover:text-primary hover:shadow-lg hover:shadow-primary/10",
              "active:scale-90"
            )}
            aria-label="Swap origin and destination"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        {/* Destination country */}
        <CountrySelector
          value={destination}
          onValueChange={setDestination}
          label="To"
          exclude={origin}
        />

        {/* Amount field */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            You send
          </label>
          <div className="relative">
            <Input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={cn(
                "h-14 rounded-xl border-border bg-muted/40 text-right text-2xl font-bold text-foreground tabular-nums sm:h-16 sm:text-3xl",
                "transition-all duration-200",
                "hover:bg-muted/60 hover:border-primary/30",
                "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
                "pr-20 pl-5"
              )}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              {originCountry?.currency || "USD"}
            </span>
          </div>
          {parsedAmount > 0 && (
            <p className="text-right text-xs text-muted-foreground">
              {"You'll compare routes for "}
              <span className="font-medium text-foreground">
                {parsedAmount.toLocaleString()} {originCountry?.currency}
              </span>
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className={cn(
            "mt-2 h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground sm:h-14 sm:text-base",
            "transition-all duration-200",
            "hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/30",
            "active:scale-[0.98]",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
          )}
          size="lg"
        >
          {loading ? (
            <span className="flex items-center gap-3">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Finding best routes...
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <Search className="h-5 w-5" />
              Compare Routes
            </span>
          )}
        </Button>

        {/* Trust signal */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary/60" />
          <span>Real-time rates from multiple anchors via Stellar</span>
        </div>
      </div>
    </div>
  );
}
