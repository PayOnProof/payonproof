"use client";

import { connectFreighter } from "@/lib/wallet";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

export type WalletType =
  | "freighter";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

interface WalletState {
  status: ConnectionStatus;
  address: string | null;
  walletType: WalletType | null;
  error: string | null;
}

interface WalletContextValue extends WalletState {
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => void;
  retry: () => void;
  truncatedAddress: string | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = "pop_wallet_state";

function truncateAddress(address: string): string {
  if (address.startsWith("G")) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeStoredAddress(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { address?: unknown }).address === "string"
  ) {
    const nested = (value as { address: string }).address.trim();
    return nested || null;
  }
  return null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    status: "disconnected",
    address: null,
    walletType: null,
    error: null,
  });

  const [lastAttemptedWallet, setLastAttemptedWallet] =
    useState<WalletType | null>(null);

  // Auto-reconnect from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const address = normalizeStoredAddress(parsed.address);
        if (address && parsed.walletType === "freighter") {
          setState({
            status: "connected",
            address,
            walletType: parsed.walletType,
            error: null,
          });
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Persist state to localStorage
  useEffect(() => {
    if (state.status === "connected" && state.address) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          address: state.address,
          walletType: state.walletType,
        })
      );
    } else if (state.status === "disconnected") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state.status, state.address, state.walletType]);

  const connect = useCallback(async (walletType: WalletType) => {
    setLastAttemptedWallet(walletType);

  setState({
    status: "connecting",
    address: null,
    walletType,
    error: null,
  });

  try {
    if (walletType !== "freighter") {
      throw new Error("Only Freighter is supported.");
    }
    const address = await connectFreighter();

    setState({
      status: "connected",
      address,
      walletType,
      error: null,
    });

  } catch (err) {
    setState({
      status: "error",
      address: null,
      walletType: null,
      error: err instanceof Error ? err.message : "Failed to connect wallet",
    });
  }
}, []);

  const disconnect = useCallback(() => {
    setState({
      status: "disconnected",
      address: null,
      walletType: null,
      error: null,
    });
  }, []);

  const retry = useCallback(() => {
    if (lastAttemptedWallet) {
      connect(lastAttemptedWallet);
    }
  }, [lastAttemptedWallet, connect]);

  const truncatedAddress =
    typeof state.address === "string" ? truncateAddress(state.address) : null;

  return (
    <WalletContext.Provider
      value={{
        ...state,
        connect,
        disconnect,
        retry,
        truncatedAddress,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}
