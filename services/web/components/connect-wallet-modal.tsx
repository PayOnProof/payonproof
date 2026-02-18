"use client";

import React from "react"

import { useCallback, useRef } from "react";
import { X, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet, type WalletType } from "@/lib/wallet-context";

interface WalletOption {
  id: WalletType;
  name: string;
  color: string;
}

const WALLETS: WalletOption[] = [
  { id: "freighter", name: "Freighter", color: "#7B61FF" },
  { id: "metamask", name: "MetaMask", color: "#E2761B" },
  { id: "walletconnect", name: "WalletConnect", color: "#3B99FC" },
  { id: "coinbase", name: "Coinbase Wallet", color: "#0052FF" },
  { id: "trust", name: "Trust Wallet", color: "#3375BB" },
];

function WalletIcon({ wallet, size = 36 }: { wallet: WalletOption; size?: number }) {
  const initials = wallet.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  return (
    <div
      className="flex items-center justify-center rounded-xl font-bold text-foreground"
      style={{
        width: size,
        height: size,
        backgroundColor: wallet.color,
        fontSize: size * 0.35,
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function addRipple(e: React.MouseEvent<HTMLButtonElement>) {
  const button = e.currentTarget;
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = e.clientX - rect.left - size / 2;
  const y = e.clientY - rect.top - size / 2;

  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  button.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

interface ConnectWalletModalProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectWalletModal({ open, onClose }: ConnectWalletModalProps) {
  const { status, error, connect, retry, disconnect } = useWallet();
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current && status !== "connecting") {
        onClose();
      }
    },
    [onClose, status]
  );

  const handleWalletClick = useCallback(
    (walletType: WalletType) => {
      connect(walletType).then(() => {
        // Close on success after a brief delay
        setTimeout(() => {
          onClose();
        }, 500);
      });
    },
    [connect, onClose]
  );

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "bg-background/80 backdrop-blur-sm",
        "animate-fade-in-scale"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Connect your wallet"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-primary/10">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={status === "connecting"}
          className={cn(
            "absolute right-4 top-4 rounded-lg p-2 text-muted-foreground",
            "transition-all duration-200",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <h2 className="mb-2 text-2xl font-bold text-foreground text-balance">
          Connect Your Wallet
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Select a wallet provider to connect to POP
        </p>

        {/* Error state */}
        {status === "error" && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 animate-fade-in-scale">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Connection failed
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {error || "An unknown error occurred"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={retry}
                className={cn(
                  "ripple-container rounded-lg px-3 py-1.5 text-xs font-medium",
                  "bg-primary text-primary-foreground",
                  "transition-all duration-200",
                  "hover:scale-105 hover:shadow-lg hover:shadow-primary/25",
                  "active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                Retry
              </button>
              <button
                onClick={disconnect}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium",
                  "bg-muted text-muted-foreground",
                  "transition-all duration-200",
                  "hover:bg-border hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Connecting state */}
        {status === "connecting" && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 animate-fade-in-scale">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">
              Connecting...
            </p>
          </div>
        )}

        {/* Wallet list */}
        <div className="flex flex-col gap-2">
          {WALLETS.map((wallet, i) => (
            <button
              key={wallet.id}
              onClick={(e) => {
                addRipple(e);
                handleWalletClick(wallet.id);
              }}
              disabled={status === "connecting"}
              className={cn(
                "ripple-container flex items-center gap-4 rounded-xl border border-border p-4",
                "transition-all duration-200",
                "hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5",
                "active:scale-[0.98] active:shadow-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none",
                "animate-fade-in-up",
                `stagger-${i + 1}`
              )}
              style={{ opacity: 0 }}
            >
              <WalletIcon wallet={wallet} />
              <span className="font-medium text-foreground">{wallet.name}</span>
              <svg
                className="ml-auto h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By connecting, you agree to the POP Terms of Service
        </p>
      </div>
    </div>
  );
}
