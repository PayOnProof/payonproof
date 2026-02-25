import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../../../lib/http";
import { upsertAnchorCallbackEvent } from "../../../lib/repositories/anchor-events";

function getQueryParam(req: VercelRequest, key: string): string {
  if (req.query && typeof req.query[key] === "string") {
    return (req.query[key] as string).trim();
  }
  const rawUrl = req.url ?? "";
  const query = rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?") + 1) : "";
  if (!query) return "";
  const params = new URLSearchParams(query);
  return params.get(key)?.trim() ?? "";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const raw = asString(obj[key]);
    if (raw) return raw;
  }
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const configuredSecret = process.env.ANCHOR_CALLBACK_SECRET?.trim() ?? "";
  const querySecret = getQueryParam(req, "secret");
  if (configuredSecret && querySecret !== configuredSecret) {
    return res.status(401).json({ error: "Invalid callback secret" });
  }

  const parsed = readJsonBody(req);
  const body = parsed.ok ? parsed.value : {};
  const payload = (body ?? {}) as Record<string, unknown>;

  const transactionId = pickString(payload, [
    "transactionId",
    "transaction_id",
    "memo",
    "client_transaction_id",
  ]) || getQueryParam(req, "transactionId");
  const callbackToken =
    pickString(payload, ["callbackToken", "callback_token"]) ||
    getQueryParam(req, "callbackToken");
  const status = pickString(payload, ["status", "state"]);
  const stellarTxHash = pickString(payload, [
    "stellarTxHash",
    "stellar_tx_hash",
    "stellar_transaction_id",
    "stellarTransactionId",
  ]);
  const externalTransactionId = pickString(payload, [
    "externalTransactionId",
    "external_transaction_id",
    "id",
  ]);
  const sourceAnchor =
    pickString(payload, ["sourceAnchor", "source_anchor", "anchor", "home_domain"]) ||
    getQueryParam(req, "sourceAnchor");

  if (!transactionId || !callbackToken) {
    return res.status(400).json({
      error: "Missing transactionId/callbackToken in callback payload",
    });
  }

  await upsertAnchorCallbackEvent({
    transactionId,
    callbackToken,
    status: status || undefined,
    stellarTxHash: stellarTxHash || undefined,
    externalTransactionId: externalTransactionId || undefined,
    sourceAnchor: sourceAnchor || undefined,
    raw: payload,
    receivedAt: new Date().toISOString(),
  });

  return res.status(200).json({ status: "ok" });
}
