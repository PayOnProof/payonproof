import type { CompareRoutesInput } from "./types.js";

export function parseCompareRoutesInput(payload: Record<string, unknown>): {
  ok: true;
  value: CompareRoutesInput;
} | {
  ok: false;
  error: string;
} {
  const origin = typeof payload.origin === "string" ? payload.origin.trim() : "";
  const destination =
    typeof payload.destination === "string" ? payload.destination.trim() : "";
  const amount =
    typeof payload.amount === "number"
      ? payload.amount
      : Number(payload.amount ?? 0);
  const networkRaw =
    typeof payload.network === "string" ? payload.network.trim().toLowerCase() : "";
  const network =
    networkRaw === "mainnet" || networkRaw === "testnet" || networkRaw === "all"
      ? networkRaw
      : undefined;

  if (!origin || !destination || !Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      error: "Missing or invalid fields: origin, destination, amount",
    };
  }

  return {
    ok: true,
    value: { origin, destination, amount, network },
  };
}
