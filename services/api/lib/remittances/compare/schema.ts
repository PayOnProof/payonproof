import type { CompareRoutesInput } from "./types";

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

  if (!origin || !destination || !Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      error: "Missing or invalid fields: origin, destination, amount",
    };
  }

  return {
    ok: true,
    value: { origin, destination, amount },
  };
}
