"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import type { RemittanceRoute, Transaction } from "@/lib/types";
import { authorizeTransfer, prepareTransfer } from "@/lib/anchors-api";
import { ensureFreighterMainnet, signFreighterTransaction } from "@/lib/wallet";
import { useWallet } from "@/lib/wallet-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  Shield,
} from "lucide-react";

interface TransactionExecutionProps {
  route: RemittanceRoute;
  amount: number;
  onBack: () => void;
  onComplete: (tx: Transaction) => void;
}

type RunPhase = "idle" | "running" | "success" | "error";

export function TransactionExecution({
  route,
  amount,
  onBack,
  onComplete,
}: TransactionExecutionProps) {
  const { status, walletType, address } = useWallet();
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdTx, setCreatedTx] = useState<Transaction | null>(null);

  const walletAddress = useMemo(() => {
    if (!address || typeof address !== "string") return "";
    return address;
  }, [address]);

  const runTransfer = useCallback(async () => {
    setPhase("running");
    setErrorMessage(null);

    try {
      if (status !== "connected" || walletType !== "freighter" || !walletAddress) {
        throw new Error("Connect Freighter wallet before executing a real transfer.");
      }
      await ensureFreighterMainnet();

      const prepared = await prepareTransfer({
        route,
        amount,
        senderAccount: walletAddress,
      });

      const signatures = {} as Record<"origin" | "destination", string>;
      const signatureByChallenge = new Map<string, string>();
      for (const anchor of prepared.anchors) {
        const cached = signatureByChallenge.get(anchor.challengeXdr);
        const signedTxXdr =
          cached ??
          (await signFreighterTransaction({
            transactionXdr: anchor.challengeXdr,
            networkPassphrase: anchor.networkPassphrase,
            address: walletAddress,
          }));
        if (!cached) {
          signatureByChallenge.set(anchor.challengeXdr, signedTxXdr);
        }
        signatures[anchor.role] = signedTxXdr;
      }

      const authorized = await authorizeTransfer({
        prepared,
        signatures,
      });

      const tx: Transaction = {
        id: authorized.transaction.id,
        route,
        amount,
        status: "processing",
        createdAt: authorized.transaction.createdAt,
        senderAccount: authorized.transaction.senderAccount,
        statusRef: authorized.transaction.statusRef,
        callbackUrl: authorized.transaction.callbackUrl,
        popEnv: authorized.transaction.popEnv,
        anchorFlows: authorized.transaction.anchorFlows,
      };

      setCreatedTx(tx);
      setPhase("success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to execute transfer";
      setErrorMessage(message);
      setPhase("error");
    }
  }, [amount, route, status, walletAddress, walletType]);

  return (
    <Card className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
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
              {phase === "success" ? "Transfer Started" : "Confirm Transfer"}
            </h2>
            <p className="text-xs text-muted-foreground">
              SEP-10 + SEP-24 flow with your Freighter wallet
            </p>
          </div>
        </div>
        {phase !== "running" && (
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

      <div className="p-4 sm:p-5 md:p-6">
        {phase !== "success" && (
          <div className="flex flex-col items-center gap-6 py-2">
            <div className="w-full rounded-xl border border-border bg-muted/20 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span className="font-medium text-foreground">
                  {route.feeAmount.toFixed(2)} {route.originCurrency} ({route.feePercentage}
                  %)
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-muted-foreground">Exchange rate</span>
                <span className="font-medium text-foreground">
                  1 {route.originCurrency} = {route.exchangeRate} {route.destinationCurrency}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-muted-foreground">Wallet</span>
                <span className="font-medium text-foreground">
                  {walletAddress || "Not connected"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-muted-foreground">Execution mode</span>
                <span className="flex items-center gap-1.5 font-medium text-primary">
                  <Shield className="h-3.5 w-3.5" />
                  SEP-10 + SEP-24
                </span>
              </div>
            </div>

            <Button
              onClick={runTransfer}
              disabled={phase === "running"}
              className={cn(
                "h-12 w-full max-w-sm rounded-xl bg-primary text-sm font-bold text-primary-foreground sm:h-14 sm:text-base",
                "transition-all duration-200",
                "hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/30",
                "active:scale-[0.98]"
              )}
              size="lg"
            >
              {phase === "running" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing and starting transfer
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Confirm & Start Transfer
                </>
              )}
            </Button>

            {errorMessage && (
              <p className="text-center text-xs font-medium text-destructive">
                {errorMessage}
              </p>
            )}
          </div>
        )}

        {phase === "success" && createdTx && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Anchor flows created successfully
                </p>
                <p className="text-xs text-muted-foreground">
                  Complete both anchor steps to settle the remittance. Then verify the on-chain
                  hash in the proof step.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {createdTx.anchorFlows?.originDeposit?.url && (
                <a
                  href={createdTx.anchorFlows.originDeposit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm"
                >
                  <span>
                    Open origin deposit ({createdTx.anchorFlows.originDeposit.anchorName})
                  </span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {createdTx.anchorFlows?.destinationWithdraw?.url && (
                <a
                  href={createdTx.anchorFlows.destinationWithdraw.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm"
                >
                  <span>
                    Open destination withdrawal (
                    {createdTx.anchorFlows.destinationWithdraw.anchorName})
                  </span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>

            <Button
              onClick={() => onComplete(createdTx)}
              className="h-12 rounded-xl bg-primary text-primary-foreground"
            >
              Continue to Proof
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
