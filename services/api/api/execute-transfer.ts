import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readJsonBody } from "../lib/http.js";
import { listActiveAnchors } from "../lib/repositories/anchors-catalog.js";
import { getAnchorCallbackEvent } from "../lib/repositories/anchor-events.js";
import type { AnchorCatalogEntry } from "../lib/remittances/compare/types.js";
import { resolveAnchorCapabilities } from "../lib/stellar/capabilities.js";
import { getPopEnv, getStellarConfig } from "../lib/stellar.js";
import { applyCors, handleCorsPreflight } from "../lib/cors.js";

/**
 * POST /api/execute-transfer
 *
 * phase=prepare:
 *   Accepts: { phase, route, amount, senderAccount }
 *   Returns SEP-10 challenge payloads for selected route anchors.
 *
 * phase=authorize:
 *   Accepts: { phase, prepared, signatures }
 *   Exchanges signed challenges for SEP-10 JWTs and starts SEP-24 interactive flows.
 *
 * phase=status:
 *   Accepts: { phase, transactionId, statusRef }
 *   Polls SEP-24 status without exposing anchor JWTs to the frontend.
 */

type ExecutePhase = "prepare" | "authorize" | "status";

interface RoutePayload {
  id: string;
  originAnchor: { id: string; name?: string };
  destinationAnchor: { id: string; name?: string };
  originCurrency: string;
  destinationCurrency: string;
  available?: boolean;
}

interface PreparedAnchorAuth {
  role: "origin" | "destination";
  anchorId: string;
  anchorName: string;
  domain: string;
  assetCode: string;
  amount: number;
  account: string;
  webAuthEndpoint: string;
  transferServerSep24: string;
  challengeXdr: string;
  networkPassphrase: string;
}

interface PreparedTransferPayload {
  transactionId: string;
  routeId: string;
  senderAccount: string;
  amount: number;
  createdAt: string;
  anchors: PreparedAnchorAuth[];
}

interface Sep24StatusHandle {
  transferServerSep24: string;
  token: string;
  interactiveId: string;
  anchorName: string;
  role: "origin" | "destination";
}

interface Sep24StatusRefPayload {
  transactionId: string;
  createdAt: string;
  callbackToken: string;
  anchors: Sep24StatusHandle[];
}

type StatusPollResult =
  | {
      role: "origin" | "destination";
      anchorName: string;
      interactiveId: string;
      ok: true;
      status?: string;
      stellarTxHash?: string;
      externalTransactionId?: string;
    }
  | {
      role: "origin" | "destination";
      anchorName: string;
      interactiveId: string;
      ok: false;
      error: string;
    };

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function resolveAnchorDomainForExecution(domain: string): string {
  const normalized = toHostname(domain);
  if (getPopEnv() !== "staging") return normalized;

  // MoneyGram test environment mapping for staging/testnet flows.
  if (normalized === "stellar.moneygram.com") {
    return "extstellar.moneygram.com";
  }
  return normalized;
}

function appendQuery(url: string, key: string, value?: string): string {
  if (!value) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function toHostname(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  }
}

function resolveClientDomain(req: VercelRequest): string {
  const explicit = process.env.SEP10_CLIENT_DOMAIN?.trim();
  if (explicit) return toHostname(explicit);

  const webOrigin = process.env.WEB_ORIGIN?.trim();
  if (webOrigin) return toHostname(webOrigin);

  const forwardedHost =
    (req.headers["x-forwarded-host"] as string | undefined)?.trim() ?? "";
  if (forwardedHost) return toHostname(forwardedHost);

  const host = (req.headers.host as string | undefined)?.trim() ?? "";
  if (host) return toHostname(host);

  if (getPopEnv() === "staging") return "localhost";
  return "";
}

function getCallbackSecret(): string {
  const secret = process.env.ANCHOR_CALLBACK_SECRET?.trim() ?? "";
  if (
    getPopEnv() === "production" &&
    (secret.length < 24 || secret.toLowerCase().includes("change_me"))
  ) {
    throw new Error(
      "ANCHOR_CALLBACK_SECRET is required and must be strong in production."
    );
  }
  return secret;
}

function getCallbackBaseUrl(req: VercelRequest): string {
  const explicit = process.env.SEP24_CALLBACK_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ??
    (req.headers.host as string | undefined) ??
    "";
  if (!host) return "";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function buildCallbackUrl(req: VercelRequest, transactionId: string, callbackToken: string): string {
  const base = getCallbackBaseUrl(req);
  if (!base) return "";
  const url = new URL(`${base}/api/anchors/sep24/callback`);
  url.searchParams.set("transactionId", transactionId);
  url.searchParams.set("callbackToken", callbackToken);
  const callbackSecret = getCallbackSecret();
  if (callbackSecret) {
    url.searchParams.set("secret", callbackSecret);
  }
  return url.toString();
}

function getExecutionStateSecret(): string {
  const secret = process.env.EXECUTION_STATE_SECRET?.trim() ?? "";
  if (!secret) {
    throw new Error(
      "Missing EXECUTION_STATE_SECRET in backend env. Required to protect SEP-24 status polling state."
    );
  }
  if (
    getPopEnv() === "production" &&
    (secret.length < 24 || secret.toLowerCase().includes("change_me"))
  ) {
    throw new Error(
      "EXECUTION_STATE_SECRET is too weak for production. Use a strong random secret."
    );
  }
  return secret;
}

function isLocalDomain(value: string): boolean {
  const normalized = toHostname(value);
  return (
    normalized === "localhost" ||
    normalized.endsWith(".local") ||
    normalized.startsWith("127.") ||
    normalized === "0.0.0.0"
  );
}

function toBase64Url(value: Buffer): string {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function encryptStatusRef(payload: Sep24StatusRefPayload): string {
  const secret = getExecutionStateSecret();
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf-8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${toBase64Url(iv)}.${toBase64Url(tag)}.${toBase64Url(encrypted)}`;
}

function decryptStatusRef(statusRef: string): Sep24StatusRefPayload {
  const secret = getExecutionStateSecret();
  const key = createHash("sha256").update(secret).digest();
  const [ivEncoded, tagEncoded, encryptedEncoded] = statusRef.split(".");
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error("Invalid statusRef format");
  }

  const iv = fromBase64Url(ivEncoded);
  const tag = fromBase64Url(tagEncoded);
  const encrypted = fromBase64Url(encryptedEncoded);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf-8");
  const parsed = JSON.parse(plain) as Sep24StatusRefPayload;
  if (
    !parsed ||
    !parsed.transactionId ||
    !parsed.callbackToken ||
    !Array.isArray(parsed.anchors)
  ) {
    throw new Error("Invalid statusRef payload");
  }
  return parsed;
}

async function fetchSep10Challenge(input: {
  webAuthEndpoint: string;
  account: string;
  homeDomain?: string;
  clientDomain?: string;
  memo?: string;
}): Promise<{ challengeXdr: string; networkPassphrase: string }> {
  const webAuthEndpoint = normalizeBaseUrl(input.webAuthEndpoint);
  let challengeUrl = appendQuery(webAuthEndpoint, "account", input.account);
  challengeUrl = appendQuery(challengeUrl, "memo", input.memo);
  challengeUrl = appendQuery(challengeUrl, "home_domain", input.homeDomain);
  challengeUrl = appendQuery(challengeUrl, "client_domain", input.clientDomain);
  const response = await fetch(challengeUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(
      `SEP-10 challenge failed at ${webAuthEndpoint} (${response.status}): ${
        raw || response.statusText
      }`
    );
  }

  const payload = (await response.json()) as {
    transaction?: string;
    network_passphrase?: string;
  };

  if (!payload.transaction) {
    throw new Error(`SEP-10 challenge missing transaction at ${webAuthEndpoint}`);
  }

  return {
    challengeXdr: payload.transaction,
    networkPassphrase:
      payload.network_passphrase || getStellarConfig().networkPassphrase,
  };
}

async function exchangeSep10Token(input: {
  webAuthEndpoint: string;
  signedChallengeXdr: string;
}): Promise<string> {
  const webAuthEndpoint = normalizeBaseUrl(input.webAuthEndpoint);
  const response = await fetch(webAuthEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ transaction: input.signedChallengeXdr }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(
      `SEP-10 token exchange failed at ${webAuthEndpoint} (${response.status}): ${
        raw || response.statusText
      }`
    );
  }

  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new Error(`SEP-10 token response missing token at ${webAuthEndpoint}`);
  }

  return payload.token;
}

async function startSep24Interactive(input: {
  transferServerSep24: string;
  token: string;
  operation: "deposit" | "withdraw";
  assetCode: string;
  account: string;
  amount: number;
  memo?: string;
  callbackUrl?: string;
}): Promise<{ id?: string; url: string; type?: string }> {
  const transferServer = normalizeBaseUrl(input.transferServerSep24);
  const endpoint = `${transferServer}/transactions/${input.operation}/interactive`;
  const body = new URLSearchParams();
  body.set("asset_code", input.assetCode);
  body.set("account", input.account);
  body.set("amount", String(input.amount));
  if (input.memo) body.set("memo", input.memo);
  if (input.callbackUrl) {
    const param = process.env.SEP24_CALLBACK_URL_PARAM?.trim();
    if (param) {
      body.set(param, input.callbackUrl);
    }
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(
      `SEP-24 ${input.operation} interactive failed at ${transferServer} (${response.status}): ${
        raw || response.statusText
      }`
    );
  }

  const payload = (await response.json()) as {
    id?: string;
    type?: string;
    url?: string;
  };

  if (!payload.url) {
    throw new Error(
      `SEP-24 ${input.operation} interactive response missing url at ${transferServer}`
    );
  }

  return { id: payload.id, type: payload.type, url: payload.url };
}

async function fetchSep24TransactionStatus(
  handle: Sep24StatusHandle
): Promise<{
  status?: string;
  stellarTxHash?: string;
  externalTransactionId?: string;
}> {
  const transferServer = normalizeBaseUrl(handle.transferServerSep24);
  const endpoint = `${transferServer}/transaction?id=${encodeURIComponent(
    handle.interactiveId
  )}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${handle.token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(
      `SEP-24 transaction status failed at ${transferServer} (${response.status}): ${
        raw || response.statusText
      }`
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const tx =
    payload && typeof payload.transaction === "object" && payload.transaction
      ? (payload.transaction as Record<string, unknown>)
      : payload;

  const status =
    typeof tx.status === "string"
      ? tx.status
      : typeof tx.state === "string"
      ? tx.state
      : undefined;

  const stellarTxHash =
    typeof tx.stellar_transaction_id === "string"
      ? tx.stellar_transaction_id
      : typeof tx.stellarTransactionId === "string"
      ? tx.stellarTransactionId
      : typeof tx.stellar_transaction_hash === "string"
      ? tx.stellar_transaction_hash
      : undefined;

  const externalTransactionId =
    typeof tx.external_transaction_id === "string"
      ? tx.external_transaction_id
      : typeof tx.externalTransactionId === "string"
      ? tx.externalTransactionId
      : undefined;

  return {
    status,
    stellarTxHash,
    externalTransactionId,
  };
}

function findAnchorById(anchors: AnchorCatalogEntry[], id: string): AnchorCatalogEntry {
  const anchor = anchors.find((item) => item.id === id);
  if (!anchor) {
    throw new Error(`Anchor not found in active catalog: ${id}`);
  }
  return anchor;
}

function isAnchorExecutionReady(anchor: AnchorCatalogEntry): boolean {
  return Boolean(
    anchor.capabilities.operational &&
      anchor.capabilities.sep10 &&
      anchor.capabilities.sep24 &&
      anchor.capabilities.webAuthEndpoint &&
      anchor.capabilities.transferServerSep24
  );
}

function isMoneyGramDomain(domain: string): boolean {
  const normalized = toHostname(domain);
  return (
    normalized === "stellar.moneygram.com" ||
    normalized === "extstellar.moneygram.com" ||
    normalized === "previewstellar.moneygram.com"
  );
}

function resolveMoneyGramUserMemo(): string | undefined {
  const raw = process.env.MONEYGRAM_TEST_USER_ID?.trim() ?? "";
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  // <= int64 max
  if (parsed > 9223372036854775807) return undefined;
  return String(parsed);
}

async function prepareAnchorAuth(input: {
  role: "origin" | "destination";
  anchor: AnchorCatalogEntry;
  assetCode: string;
  amount: number;
  account: string;
  clientDomain?: string;
}): Promise<PreparedAnchorAuth> {
  const executionDomain = resolveAnchorDomainForExecution(input.anchor.domain);
  const moneyGramMemo = isMoneyGramDomain(executionDomain)
    ? resolveMoneyGramUserMemo()
    : undefined;
  const resolved = await resolveAnchorCapabilities({
    domain: executionDomain,
    assetCode: input.assetCode,
  });

  const webAuthEndpoint = asString(resolved.endpoints.webAuthEndpoint);
  const transferServerSep24 = asString(resolved.endpoints.transferServerSep24);

  if (!webAuthEndpoint || !isHttpsUrl(webAuthEndpoint)) {
    throw new Error(`Anchor ${input.anchor.name} has no valid SEP-10 endpoint`);
  }
  if (!transferServerSep24 || !isHttpsUrl(transferServerSep24)) {
    throw new Error(`Anchor ${input.anchor.name} has no valid SEP-24 endpoint`);
  }

  const challenge = await fetchSep10Challenge({
    webAuthEndpoint,
    account: input.account,
    memo: moneyGramMemo,
    homeDomain: executionDomain,
    clientDomain: input.clientDomain,
  });

  return {
    role: input.role,
    anchorId: input.anchor.id,
    anchorName: input.anchor.name,
    domain: executionDomain,
    assetCode: input.assetCode,
    amount: input.amount,
    account: input.account,
    webAuthEndpoint,
    transferServerSep24,
    challengeXdr: challenge.challengeXdr,
    networkPassphrase: challenge.networkPassphrase,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsPreflight(req, res, ["POST", "OPTIONS"])) return;
  applyCors(req, res, ["POST", "OPTIONS"]);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = readJsonBody(req);
  if (!parsed.ok) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const phase = asString(parsed.value.phase) as ExecutePhase;
  if (phase !== "prepare" && phase !== "authorize" && phase !== "status") {
    return res.status(400).json({
      error: "Invalid phase. Use 'prepare', 'authorize', or 'status'.",
    });
  }

  try {
    if (phase === "prepare") {
      const route = parsed.value.route as RoutePayload | undefined;
      const senderAccount = asString(parsed.value.senderAccount);
      const amount = asNumber(parsed.value.amount);
      const clientDomain = resolveClientDomain(req);
      const routeAvailable = Boolean(route?.available);

      if (!route || !route.id) {
        return res.status(400).json({ error: "Missing field: route" });
      }
      if (!senderAccount) {
        return res.status(400).json({ error: "Missing field: senderAccount" });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "Invalid field: amount" });
      }
      if (!routeAvailable) {
        return res.status(400).json({
          error:
            "Selected route is not operational. Choose an available route (anchors with valid SEP-10/SEP-24).",
        });
      }
      if (!clientDomain) {
        return res.status(400).json({
          error:
            "Unable to resolve client_domain for SEP-10. Set SEP10_CLIENT_DOMAIN in API env.",
        });
      }
      if (getPopEnv() === "production" && isLocalDomain(clientDomain)) {
        return res.status(400).json({
          error:
            "Invalid SEP10_CLIENT_DOMAIN for production. Use a public domain, not localhost.",
        });
      }

      const anchors = await listActiveAnchors();
      const originAnchor = findAnchorById(anchors, asString(route.originAnchor?.id));
      const destinationAnchor = findAnchorById(
        anchors,
        asString(route.destinationAnchor?.id)
      );
      if (!isAnchorExecutionReady(originAnchor) || !isAnchorExecutionReady(destinationAnchor)) {
        return res.status(400).json({
          error:
            "Selected anchors are not execution-ready. They must support SEP-10 and SEP-24 with valid endpoints.",
        });
      }

      const transactionId = `POP-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;

      const preparedAnchors = await Promise.all([
        prepareAnchorAuth({
          role: "origin",
          anchor: originAnchor,
          assetCode: asString(route.originCurrency) || originAnchor.currency,
          amount,
          account: senderAccount,
          clientDomain,
        }),
        prepareAnchorAuth({
          role: "destination",
          anchor: destinationAnchor,
          assetCode: asString(route.destinationCurrency) || destinationAnchor.currency,
          amount,
          account: senderAccount,
          clientDomain,
        }),
      ]);

      const prepared: PreparedTransferPayload = {
        transactionId,
        routeId: route.id,
        senderAccount,
        amount,
        createdAt: new Date().toISOString(),
        anchors: preparedAnchors,
      };

      return res.status(200).json({
        status: "needs_signature",
        meta: {
          clientDomain,
        },
        prepared,
      });
    }

    if (phase === "status") {
      const transactionId = asString(parsed.value.transactionId);
      const statusRef = asString(parsed.value.statusRef);
      if (!transactionId) {
        return res.status(400).json({ error: "Missing field: transactionId" });
      }
      if (!statusRef) {
        return res.status(400).json({ error: "Missing field: statusRef" });
      }

      const state = decryptStatusRef(statusRef);
      if (state.transactionId !== transactionId) {
        return res.status(400).json({ error: "statusRef does not match transactionId" });
      }

      const callbackEvent = await getAnchorCallbackEvent({
        transactionId,
        callbackToken: state.callbackToken,
      });
      if (callbackEvent?.stellarTxHash) {
        return res.status(200).json({
          status: "ok",
          transactionId,
          stellarTxHash: callbackEvent.stellarTxHash,
          completed: true,
          source: "callback",
          anchors: [],
        });
      }

      const results: StatusPollResult[] = await Promise.all(
        state.anchors.map(async (handle) => {
          try {
            const s = await fetchSep24TransactionStatus(handle);
            return {
              role: handle.role,
              anchorName: handle.anchorName,
              interactiveId: handle.interactiveId,
              ok: true,
              status: s.status,
              stellarTxHash: s.stellarTxHash,
              externalTransactionId: s.externalTransactionId,
            };
          } catch (error) {
            return {
              role: handle.role,
              anchorName: handle.anchorName,
              interactiveId: handle.interactiveId,
              ok: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        })
      );

      const firstHash = results
        .filter((item): item is Extract<StatusPollResult, { ok: true }> => item.ok)
        .find((item) => item.stellarTxHash)?.stellarTxHash;
      const completed = results.some((item) => {
        if (!item.ok || !item.status) return false;
        const normalized = item.status.toLowerCase();
        return normalized.includes("complete") || normalized.includes("completed");
      });

      return res.status(200).json({
        status: "ok",
        transactionId,
        stellarTxHash: firstHash,
        completed,
        anchors: results,
      });
    }

    const prepared = parsed.value.prepared as PreparedTransferPayload | undefined;
    const signatures = parsed.value.signatures as Record<string, string> | undefined;

    if (!prepared || !prepared.transactionId || !Array.isArray(prepared.anchors)) {
      return res.status(400).json({ error: "Missing field: prepared" });
    }
    if (!signatures || typeof signatures !== "object") {
      return res.status(400).json({ error: "Missing field: signatures" });
    }

    const interactiveByRole: Record<
      string,
      { id?: string; url: string; type?: string; anchorName: string }
    > = {};
    const statusHandles: Sep24StatusHandle[] = [];
    const callbackToken = randomBytes(18).toString("hex");
    const callbackUrl = buildCallbackUrl(req, prepared.transactionId, callbackToken);

    for (const anchor of prepared.anchors) {
      const signedChallengeXdr = asString(signatures[anchor.role]);
      if (!signedChallengeXdr) {
        return res.status(400).json({ error: `Missing signature for role '${anchor.role}'` });
      }

      const token = await exchangeSep10Token({
        webAuthEndpoint: anchor.webAuthEndpoint,
        signedChallengeXdr,
      });

      const operation = anchor.role === "origin" ? "deposit" : "withdraw";
      const interactive = await startSep24Interactive({
        transferServerSep24: anchor.transferServerSep24,
        token,
        operation,
        assetCode: anchor.assetCode,
        account: anchor.account,
        amount: anchor.amount,
        memo: prepared.transactionId,
        callbackUrl,
      });

      interactiveByRole[anchor.role] = {
        ...interactive,
        anchorName: anchor.anchorName,
      };
      if (interactive.id) {
        statusHandles.push({
          transferServerSep24: anchor.transferServerSep24,
          token,
          interactiveId: interactive.id,
          anchorName: anchor.anchorName,
          role: anchor.role,
        });
      }
    }

    const statusRef = encryptStatusRef({
      transactionId: prepared.transactionId,
      createdAt: new Date().toISOString(),
      callbackToken,
      anchors: statusHandles,
    });

    return res.status(200).json({
      status: "processing",
      transaction: {
        id: prepared.transactionId,
        routeId: prepared.routeId,
        amount: prepared.amount,
        status: "processing",
        createdAt: prepared.createdAt,
        senderAccount: prepared.senderAccount,
        statusRef,
        callbackUrl: callbackUrl || undefined,
        popEnv: getPopEnv(),
        anchorFlows: {
          originDeposit: interactiveByRole.origin,
          destinationWithdraw: interactiveByRole.destination,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: message });
  }
}
