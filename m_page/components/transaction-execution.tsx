"use client";

import React from "react"

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type {
  RemittanceRoute,
  Transaction,
  ProofOfPayment,
} from "@/lib/mock-data";
import { generateStellarHash, generateTransactionId } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Shield,
  ArrowRight,
  Loader2,
  XCircle,
  Lock,
  Banknote,
  Globe,
  Landmark,
} from "lucide-react";

interface TransactionExecutionProps {
  route: RemittanceRoute;
  amount: number;
  onBack: () => void;
  onComplete: (tx: Transaction) => void;
}

const BASE_STEPS = [
  {
    key: "init",
    label: "Initializing transfer",
    description: "Connecting to anchors...",
    icon: Globe,
  },
  {
    key: "onramp",
    label: "On-ramp processing",
    description: "Depositing funds via origin anchor...",
    icon: Banknote,
  },
  {
    key: "escrow",
    label: "Escrow verification",
    description: "Securing funds in programmatic escrow...",
    icon: Shield,
  },
  {
    key: "bridge",
    label: "Stellar bridge",
    description: "Transferring via Stellar network...",
    icon: Globe,
  },
  {
    key: "offramp",
    label: "Off-ramp settlement",
    description: "Delivering to destination anchor...",
    icon: Landmark,
  },
  {
    key: "complete",
    label: "Transfer complete",
    description: "Funds delivered successfully",
    icon: CheckCircle2,
  },
];

export function TransactionExecution({
  route,
  amount,
  onBack,
  onComplete,
}: TransactionExecutionProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [txId] = useState(() => generateTransactionId());
  const [stellarHash] = useState(() => generateStellarHash());

  const stepsToShow = route.escrow
    ? BASE_STEPS
    : BASE_STEPS.filter((s) => s.key !== "escrow");

  const progress = Math.round((currentStep / (stepsToShow.length - 1)) * 100);
  const isComplete = currentStep === stepsToShow.length - 1;

  useEffect(() => {
    if (!started || isComplete || failed) return;
    const delay = 900 + Math.random() * 1200;
    const timer = setTimeout(() => {
      if (stepsToShow[currentStep]?.key === "bridge" && Math.random() < 0.05) {
        setFailed(true);
        return;
      }
      setCurrentStep((prev) => prev + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [started, currentStep, isComplete, failed, stepsToShow]);

  const handleComplete = useCallback(() => {
    const now = new Date().toISOString();
    const pop: ProofOfPayment = {
      id: `POP-${Date.now()}`,
      transactionId: txId,
      timestamp: now,
      sender: "User Wallet",
      receiver: "Recipient",
      originAmount: amount,
      originCurrency: route.originCurrency,
      destinationAmount: route.receivedAmount,
      destinationCurrency: route.destinationCurrency,
      exchangeRate: route.exchangeRate,
      totalFees: route.feeAmount,
      route: `${route.originAnchor.name} > ${route.destinationAnchor.name}`,
      stellarTxHash: stellarHash,
      status: "verified",
    };
    const tx: Transaction = {
      id: txId,
      route,
      amount,
      status: "completed",
      createdAt: now,
      completedAt: now,
      stellarTxHash: stellarHash,
      proofOfPayment: pop,
    };
    onComplete(tx);
  }, [txId, amount, route, stellarHash, onComplete]);

  return (
    <Card className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-1 rounded-lg bg-primary/20 blur-md" />
            <Image
              src="/isotipo.png"
              alt="POP"
              width={28}
              height={28}
              className="relative rounded-md"
            />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              {isComplete
                ? "Transfer Complete"
                : failed
                  ? "Transfer Failed"
                  : started
                    ? "Processing Transfer"
                    : "Confirm Transfer"}
            </h2>
            <p className="font-mono text-[10px] text-muted-foreground">
              {txId}
            </p>
          </div>
        </div>
        {!started && (
          <Button
            variant="ghost"
            onClick={onBack}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
      </div>

      {/* Route summary bar */}
      <div className="border-b border-border bg-muted/10 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-col items-center gap-3 text-center sm:gap-4 md:flex-row md:justify-between md:text-left">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Sending
            </p>
            <p className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">
              {amount.toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {route.originCurrency}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {route.originAnchor.name}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">
              {route.destinationAnchor.name}
            </span>
          </div>
          <div className="md:text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Recipient gets
            </p>
            <p className="text-xl font-bold tabular-nums text-primary sm:text-2xl">
              {route.receivedAmount.toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {route.destinationCurrency}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 md:p-6">
        {!started ? (
          /* Pre-confirmation view */
          <div className="flex flex-col items-center gap-6 py-2">
            <div className="w-full rounded-xl border border-border bg-muted/20 p-5">
              <div className="flex flex-col gap-3.5 text-sm">
                <SummaryRow
                  label="Fee"
                  value={`${route.feeAmount.toFixed(2)} ${route.originCurrency} (${route.feePercentage}%)`}
                />
                <SummaryRow
                  label="Exchange rate"
                  value={`1 ${route.originCurrency} = ${route.exchangeRate} ${route.destinationCurrency}`}
                />
                <SummaryRow
                  label="Est. time"
                  value={route.estimatedTime}
                  icon={<Clock className="h-3.5 w-3.5" />}
                />
                {route.escrow && (
                  <SummaryRow
                    label="Protection"
                    value="Escrow enabled"
                    icon={<Shield className="h-3.5 w-3.5 text-primary" />}
                    valueClassName="text-primary"
                  />
                )}
              </div>
            </div>

            <Button
              onClick={() => setStarted(true)}
              className={cn(
                "h-12 w-full max-w-sm rounded-xl bg-primary text-sm font-bold text-primary-foreground sm:h-14 sm:text-base",
                "transition-all duration-200",
                "hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/30",
                "active:scale-[0.98]",
                "glow-pulse"
              )}
              size="lg"
            >
              <Lock className="mr-2 h-4 w-4" />
              Confirm & Send
            </Button>
            <p className="max-w-xs text-center text-[10px] leading-relaxed text-muted-foreground">
              By confirming, you agree to execute this transfer through the
              selected anchors via the Stellar network.
            </p>
          </div>
        ) : (
          /* Execution progress view */
          <div className="flex flex-col gap-5">
            {/* Progress bar */}
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                  failed ? "bg-destructive" : isComplete ? "bg-success" : "bg-primary"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Step list */}
            <div className="flex flex-col gap-2">
              {stepsToShow.map((step, index) => {
                const isActive = index === currentStep && !isComplete;
                const isDone = index < currentStep || isComplete;
                const isFailed = failed && index === currentStep;
                const StepIcon = step.icon;

                return (
                  <div
                    key={step.key}
                    className={cn(
                      "flex items-center gap-4 rounded-xl px-4 py-3 transition-all duration-300",
                      isActive && "bg-primary/5 ring-1 ring-primary/20",
                      isDone && "opacity-60",
                      isFailed && "bg-destructive/5 ring-1 ring-destructive/20"
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                      {isFailed ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : isActive ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <StepIcon className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          isDone || isActive
                            ? "text-foreground"
                            : "text-muted-foreground/50"
                        )}
                      >
                        {step.label}
                      </p>
                      {(isActive || isFailed) && (
                        <p
                          className={cn(
                            "mt-0.5 text-xs",
                            isFailed
                              ? "text-destructive"
                              : "text-muted-foreground"
                          )}
                        >
                          {isFailed
                            ? "An error occurred. Please retry or choose another route."
                            : step.description}
                        </p>
                      )}
                    </div>
                    {isDone && (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        Done
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Completion CTA */}
            {isComplete && (
              <Button
                onClick={handleComplete}
                className={cn(
                  "mt-2 h-14 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground",
                  "transition-all duration-200",
                  "hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/30",
                  "active:scale-[0.98]"
                )}
                size="lg"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                View Proof of Payment
              </Button>
            )}

            {/* Failure CTAs */}
            {failed && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onBack}
                  className="flex-1 rounded-xl bg-transparent"
                >
                  Choose Another Route
                </Button>
                <Button
                  onClick={() => {
                    setFailed(false);
                    setCurrentStep(0);
                    setStarted(true);
                  }}
                  className="flex-1 rounded-xl bg-primary text-primary-foreground"
                >
                  Retry Transfer
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function SummaryRow({
  label,
  value,
  icon,
  valueClassName,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "flex items-center gap-1.5 font-medium text-foreground",
          valueClassName
        )}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}
