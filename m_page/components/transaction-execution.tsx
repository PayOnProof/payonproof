"use client";

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
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";

interface TransactionExecutionProps {
  route: RemittanceRoute;
  amount: number;
  onBack: () => void;
  onComplete: (tx: Transaction) => void;
}

const STEPS = [
  {
    key: "init",
    label: "Initializing transfer",
    description: "Connecting to anchors...",
  },
  {
    key: "onramp",
    label: "On-ramp processing",
    description: "Depositing funds via origin anchor...",
  },
  {
    key: "escrow",
    label: "Escrow verification",
    description: "Securing funds in programmatic escrow...",
  },
  {
    key: "bridge",
    label: "Stellar bridge",
    description: "Transferring via Stellar network...",
  },
  {
    key: "offramp",
    label: "Off-ramp settlement",
    description: "Delivering to destination anchor...",
  },
  {
    key: "complete",
    label: "Transfer complete",
    description: "Funds delivered successfully",
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
    ? STEPS
    : STEPS.filter((s) => s.key !== "escrow");

  const progress = Math.round((currentStep / (stepsToShow.length - 1)) * 100);
  const isComplete = currentStep === stepsToShow.length - 1;

  useEffect(() => {
    if (!started || isComplete || failed) return;

    const delay = 800 + Math.random() * 1200;
    const timer = setTimeout(() => {
      if (
        stepsToShow[currentStep]?.key === "bridge" &&
        Math.random() < 0.05
      ) {
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
    <Card className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-background/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <Image
            src="/isotipo.png"
            alt="POP"
            width={24}
            height={24}
            className="rounded-md"
          />
          <div>
            <h2 className="text-base font-bold text-foreground">
              {isComplete
                ? "Transfer Complete"
                : failed
                  ? "Transfer Failed"
                  : "Processing Transfer"}
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
            className="gap-1 text-muted-foreground hover:text-foreground"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
      </div>

      {/* Route summary */}
      <div className="border-b border-border bg-muted/20 px-5 py-4">
        <div className="flex flex-col items-center gap-3 text-center md:flex-row md:justify-between md:text-left">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sending
            </p>
            <p className="text-xl font-bold text-foreground">
              {amount.toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {route.originCurrency}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {route.originAnchor.name}
            </span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-foreground">
              {route.destinationAnchor.name}
            </span>
          </div>
          <div className="md:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recipient gets
            </p>
            <p className="text-xl font-bold text-primary">
              {route.receivedAmount.toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {route.destinationCurrency}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {!started ? (
          <div className="flex flex-col items-center gap-5 py-4">
            {/* Summary card */}
            <div className="w-full rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="font-medium text-foreground">
                    {route.feeAmount.toFixed(2)} {route.originCurrency} (
                    {route.feePercentage}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exchange rate</span>
                  <span className="font-medium text-foreground">
                    1 {route.originCurrency} = {route.exchangeRate}{" "}
                    {route.destinationCurrency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. time</span>
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Clock className="h-3 w-3" />
                    {route.estimatedTime}
                  </span>
                </div>
                {route.escrow && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Protection</span>
                    <span className="flex items-center gap-1 font-medium text-primary">
                      <Shield className="h-3 w-3" />
                      Escrow enabled
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={() => setStarted(true)}
              className={cn(
                "h-14 w-full max-w-xs rounded-xl bg-primary text-base font-bold text-primary-foreground",
                "transition-all duration-200",
                "hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25",
                "active:scale-[0.98]",
                "glow-pulse"
              )}
              size="lg"
            >
              <Lock className="mr-2 h-4 w-4" />
              Confirm & Send
            </Button>
            <p className="text-center text-[10px] text-muted-foreground">
              By confirming, you agree to execute this transfer via the selected
              route.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <Progress value={progress} className="h-2" />

            <div className="flex flex-col gap-3">
              {stepsToShow.map((step, index) => {
                const isActive = index === currentStep && !isComplete;
                const isDone = index < currentStep || isComplete;
                const isFailed = failed && index === currentStep;

                return (
                  <div
                    key={step.key}
                    className={cn(
                      "flex items-start gap-3 rounded-lg p-3 transition-all duration-300",
                      isActive && "bg-primary/5 border border-primary/20",
                      isDone && "opacity-70",
                      isFailed && "bg-destructive/5 border border-destructive/20"
                    )}
                  >
                    <div className="mt-0.5">
                      {isFailed ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : isActive ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-border" />
                      )}
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          isDone || isActive
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {step.label}
                      </p>
                      {(isActive || isFailed) && (
                        <p
                          className={cn(
                            "text-xs",
                            isFailed
                              ? "text-destructive"
                              : "text-muted-foreground"
                          )}
                        >
                          {isFailed
                            ? "An error occurred. Please try again."
                            : step.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {isComplete && (
              <Button
                onClick={handleComplete}
                className={cn(
                  "mt-2 h-14 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground",
                  "transition-all duration-200",
                  "hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25",
                  "active:scale-[0.98]"
                )}
                size="lg"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                View Proof of Payment
              </Button>
            )}

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
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
