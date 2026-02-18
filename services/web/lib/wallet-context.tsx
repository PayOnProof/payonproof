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
  | "freighter"
  | "metamask"
  | "walletconnect"
  | "coinbase"
  | "trust";

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

function generateMockAddress(walletType: WalletType): string {
  const chars = "0123456789abcdef";
  let addr = "";
  for (let i = 0; i < 40; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  if (walletType === "freighter") {
    return "G" + addr.toUpperCase().slice(0, 55);
  }
  return "0x" + addr;
}

function truncateAddress(address: string): string {
  if (address.startsWith("G")) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
        if (parsed.address && parsed.walletType) {
          setState({
            status: "connected",
            address: parsed.address,
            walletType: parsed.walletType,
            error: null,
          });
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
    let address: string;

    if (walletType === "freighter") {
      const result = await connectFreighter();
      address = result.address;
    } else {
      // Mock para otros wallets
      await new Promise((resolve) =>
        setTimeout(resolve, 1000)
      );
      address = generateMockAddress(walletType);
    }

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

  const truncatedAddress = state.address
    ? truncateAddress(state.address)
    : null;

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
