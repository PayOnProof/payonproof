import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
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
  assetIssuer?: string;
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

const SEP10_CHALLENGE_CACHE_TTL_MS = 30_000;
const sep10ChallengeCache = new Map<
  string,
  { expiresAt: number; value: { challengeXdr: string; networkPassphrase: string } }
>();

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

function matchesSepAssetKey(key: string, assetCode: string): boolean {
  const normalizedKey = key.trim().toUpperCase();
  const normalizedAsset = assetCode.trim().toUpperCase();
  return (
    normalizedKey === normalizedAsset ||
    normalizedKey.startsWith(`${normalizedAsset}:`)
  );
}

function isSep24AssetSupported(
  sep24Info: unknown,
  assetCode: string,
  role: "origin" | "destination"
): boolean {
  if (!sep24Info || typeof sep24Info !== "object") return true;
  const root = sep24Info as Record<string, unknown>;
  const sectionName = role === "origin" ? "deposit" : "withdraw";
  const section = root[sectionName];
  if (!section || typeof section !== "object") return true;
  const sectionObj = section as Record<string, unknown>;
  const keys = Object.keys(sectionObj);
  if (keys.length === 0) return true;
  return keys.some((key) => {
    if (!matchesSepAssetKey(key, assetCode)) return false;
    const row = sectionObj[key];
    if (!row || typeof row !== "object") return true;
    const enabled = (row as Record<string, unknown>).enabled;
    return enabled !== false;
  });
}

function parseSep24AssetKey(key: string): { assetCode: string; assetIssuer?: string } | null {
  const [codeRaw, issuerRaw] = key.split(":");
  const assetCode = codeRaw?.trim().toUpperCase();
  if (!assetCode) return null;
  const assetIssuer = issuerRaw?.trim() || undefined;
  return { assetCode, assetIssuer };
}

function resolveSep24AssetSelection(
  sep24Info: unknown,
  requestedAssetCode: string,
  role: "origin" | "destination"
): { assetCode: string; assetIssuer?: string } | null {
  if (!sep24Info || typeof sep24Info !== "object") return null;
  const root = sep24Info as Record<string, unknown>;
  const sectionName = role === "origin" ? "deposit" : "withdraw";
  const section = root[sectionName];
  if (!section || typeof section !== "object") return null;
  const sectionObj = section as Record<string, unknown>;
  const keys = Object.keys(sectionObj);
  if (keys.length === 0) return null;
  const normalizedRequested = requestedAssetCode.trim().toUpperCase();
  const isEnabled = (key: string): boolean => {
    const row = sectionObj[key];
    if (!row || typeof row !== "object") return true;
    const enabled = (row as Record<string, unknown>).enabled;
    return enabled !== false;
  };
  const enabledKeys = keys.filter((key) => isEnabled(key));
  const firstEnabledWithIssuer = enabledKeys.find((key) => key.includes(":"));

  const matched = keys.find(
    (key) => matchesSepAssetKey(key, normalizedRequested) && isEnabled(key)
  );
  if (matched) {
    const parsedMatched = parseSep24AssetKey(matched);
    // If requested matched only a fiat-like code without issuer, prefer a canonical issued asset.
    if (parsedMatched && !parsedMatched.assetIssuer && firstEnabledWithIssuer) {
      return parseSep24AssetKey(firstEnabledWithIssuer);
    }
    return parsedMatched;
  }

  const fallbackEnabled = enabledKeys[0];
  if (fallbackEnabled) return parseSep24AssetKey(fallbackEnabled);

  for (const key of keys) {
    const parsed = parseSep24AssetKey(key);
    if (parsed) return parsed;
  }
  return null;
}

function shouldSendSep10ClientDomain(): boolean {
  const raw = (process.env.SEP10_SEND_CLIENT_DOMAIN ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

function shouldSendSep10HomeDomain(): boolean {
  const raw = (process.env.SEP10_SEND_HOME_DOMAIN ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

function shouldRequireClientDomainSignature(): boolean {
  const raw = (process.env.SEP10_REQUIRE_CLIENT_SIGNATURE ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

function getClientDomainSigningSecret(): string {
  return process.env.SEP10_CLIENT_DOMAIN_SIGNING_SECRET?.trim() ?? "";
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
  const cacheKey = [
    webAuthEndpoint,
    input.account,
    input.homeDomain ?? "",
    input.clientDomain ?? "",
    input.memo ?? "",
  ].join("|");
  const cached = sep10ChallengeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const attempts: Array<{
    memo?: string;
    homeDomain?: string;
    clientDomain?: string;
  }> = [];

  if (input.clientDomain) {
    attempts.push(
      {
        memo: input.memo,
        homeDomain: input.homeDomain,
        clientDomain: input.clientDomain,
      },
      { clientDomain: input.clientDomain },
      { homeDomain: input.homeDomain, clientDomain: input.clientDomain }
    );
  } else {
    attempts.push(
      {
        memo: input.memo,
        homeDomain: input.homeDomain,
      },
      { homeDomain: input.homeDomain },
      {}
    );
  }

  const seen = new Set<string>();
  const deduped = attempts.filter((attempt) => {
    const key = JSON.stringify(attempt);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let lastError = "";
  for (const attempt of deduped) {
    let challengeUrl = appendQuery(webAuthEndpoint, "account", input.account);
    challengeUrl = appendQuery(challengeUrl, "memo", attempt.memo);
    challengeUrl = appendQuery(challengeUrl, "home_domain", attempt.homeDomain);
    challengeUrl = appendQuery(challengeUrl, "client_domain", attempt.clientDomain);

    const response = await fetch(challengeUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const raw = await response.text();
      lastError = `SEP-10 challenge failed at ${webAuthEndpoint} (${response.status}): ${
        raw || response.statusText
      }`;
      continue;
    }

    const payload = (await response.json()) as {
      transaction?: string;
      network_passphrase?: string;
    };

    if (!payload.transaction) {
      lastError = `SEP-10 challenge missing transaction at ${webAuthEndpoint}`;
      continue;
    }

    const value = {
      challengeXdr: payload.transaction,
      networkPassphrase:
        payload.network_passphrase || getStellarConfig().networkPassphrase,
    };
    sep10ChallengeCache.set(cacheKey, {
      expiresAt: Date.now() + SEP10_CHALLENGE_CACHE_TTL_MS,
      value,
    });
    return value;
  }

  throw new Error(lastError || `SEP-10 challenge failed at ${webAuthEndpoint}`);
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
  assetIssuer?: string;
  account: string;
  amount: number;
  memo?: string;
  callbackUrl?: string;
}): Promise<{ id?: string; url: string; type?: string }> {
  const transferServer = normalizeBaseUrl(input.transferServerSep24);
  const endpoint = `${transferServer}/transactions/${input.operation}/interactive`;
  const attempts: Array<{ assetCode: string; assetIssuer?: string }> = [];
  attempts.push({ assetCode: input.assetCode, assetIssuer: input.assetIssuer });
  if (input.assetIssuer) {
    attempts.push({ assetCode: `${input.assetCode}:${input.assetIssuer}` });
    attempts.push({ assetCode: input.assetCode });
  }

  const seen = new Set<string>();
  const deduped = attempts.filter((attempt) => {
    const key = `${attempt.assetCode}|${attempt.assetIssuer ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let lastError = "";
  for (const attempt of deduped) {
    const callbackParam = process.env.SEP24_CALLBACK_URL_PARAM?.trim();
    const requestBody: Record<string, string> = {
      asset_code: attempt.assetCode,
      account: input.account,
      amount: String(input.amount),
    };
    if (attempt.assetIssuer) requestBody.asset_issuer = attempt.assetIssuer;
    if (input.memo) requestBody.memo = input.memo;
    if (input.callbackUrl && callbackParam) requestBody[callbackParam] = input.callbackUrl;

    // Some anchors (MoneyGram sandbox) require JSON, others expect form-encoded.
    const transportAttempts: Array<{ contentType: string; body: string }> = [
      {
        contentType: "application/json",
        body: JSON.stringify(requestBody),
      },
      {
        contentType: "application/x-www-form-urlencoded",
        body: new URLSearchParams(requestBody).toString(),
      },
    ];

    for (const transport of transportAttempts) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.token}`,
          "Content-Type": transport.contentType,
          Accept: "application/json",
        },
        body: transport.body,
      });

      if (!response.ok) {
        const raw = await response.text();
        lastError = `SEP-24 ${input.operation} interactive failed at ${transferServer} (${response.status}): ${
          raw || response.statusText
        }. request={asset_code:${attempt.assetCode}${
          attempt.assetIssuer ? `,asset_issuer:${attempt.assetIssuer}` : ""
        },account:${input.account},amount:${input.amount},content_type:${transport.contentType}}`;
        continue;
      }

      const payload = (await response.json()) as {
        id?: string;
        type?: string;
        url?: string;
      };

      if (!payload.url) {
        lastError = `SEP-24 ${input.operation} interactive response missing url at ${transferServer}`;
        continue;
      }

      return { id: payload.id, type: payload.type, url: payload.url };
    }
  }

  throw new Error(
    lastError ||
      `SEP-24 ${input.operation} interactive failed at ${transferServer}`
  );
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
  const raw =
    process.env.MONEYGRAM_USER_ID?.trim() ??
    process.env.MONEYGRAM_TEST_USER_ID?.trim() ??
    "";
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  // <= int64 max
  if (parsed > 9223372036854775807) return undefined;
  return String(parsed);
}

function isMoneyGramUserIdRequired(): boolean {
  const raw = (process.env.MONEYGRAM_REQUIRE_USER_ID ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

function shouldSignClientDomainForAnchor(domain: string): boolean {
  return isMoneyGramDomain(domain) || shouldRequireClientDomainSignature();
}

function signClientDomainChallenge(input: {
  transactionXdr: string;
  networkPassphrase: string;
  anchorDomain: string;
}): string {
  if (!shouldSignClientDomainForAnchor(input.anchorDomain)) {
    return input.transactionXdr;
  }

  const signingSecret = getClientDomainSigningSecret();
  if (!signingSecret) {
    throw new Error(
      "SEP10 client-domain signature required. Set SEP10_CLIENT_DOMAIN_SIGNING_SECRET in API env."
    );
  }

  if (!/^S[A-Z2-7]{55}$/.test(signingSecret)) {
    throw new Error(
      "Invalid SEP10_CLIENT_DOMAIN_SIGNING_SECRET format. It must be a Stellar secret seed starting with 'S' (not a public key 'G' and not hex/base64)."
    );
  }

  const tx = TransactionBuilder.fromXDR(
    input.transactionXdr,
    input.networkPassphrase
  );
  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecret(signingSecret);
  } catch {
    throw new Error(
      "Invalid SEP10_CLIENT_DOMAIN_SIGNING_SECRET value. Use the wallet-domain signing secret that matches SIGNING_KEY in /.well-known/stellar.toml."
    );
  }
  tx.sign(keypair);
  return tx.toXDR();
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
  const isMoneyGram = isMoneyGramDomain(executionDomain);
  const moneyGramMemo = isMoneyGram ? resolveMoneyGramUserMemo() : undefined;
  if (isMoneyGram && isMoneyGramUserIdRequired() && !moneyGramMemo) {
    throw new Error(
      "MoneyGram user integer memo is required by current config. Set MONEYGRAM_USER_ID (or MONEYGRAM_TEST_USER_ID), or disable MONEYGRAM_REQUIRE_USER_ID."
    );
  }
  if (isMoneyGram && !input.clientDomain) {
    throw new Error(
      "MoneyGram requires client_domain for SEP-10 challenge. Set SEP10_CLIENT_DOMAIN in API env."
    );
  }
  const resolved = await resolveAnchorCapabilities({
    domain: executionDomain,
    assetCode: input.assetCode,
  });

  const webAuthEndpoint = asString(resolved.endpoints.webAuthEndpoint);
  const transferServerSep24 = asString(resolved.endpoints.transferServerSep24);
  let effectiveAssetCode = input.assetCode.trim().toUpperCase();
  let effectiveAssetIssuer: string | undefined;
  const selectedAsset = resolveSep24AssetSelection(
    resolved.raw?.sep24Info,
    effectiveAssetCode,
    input.role
  );
  if (selectedAsset && selectedAsset.assetCode === effectiveAssetCode) {
    effectiveAssetIssuer = selectedAsset.assetIssuer;
  }

  if (!webAuthEndpoint || !isHttpsUrl(webAuthEndpoint)) {
    throw new Error(`Anchor ${input.anchor.name} has no valid SEP-10 endpoint`);
  }
  if (!transferServerSep24 || !isHttpsUrl(transferServerSep24)) {
    throw new Error(`Anchor ${input.anchor.name} has no valid SEP-24 endpoint`);
  }
  if (!isSep24AssetSupported(resolved.raw?.sep24Info, effectiveAssetCode, input.role)) {
    if (selectedAsset) {
      effectiveAssetCode = selectedAsset.assetCode;
      effectiveAssetIssuer = selectedAsset.assetIssuer;
    } else {
      throw new Error(
        `Anchor ${input.anchor.name} does not support asset_code '${input.assetCode}' for ${
          input.role === "origin" ? "deposit" : "withdraw"
        } in SEP-24 /info`
      );
    }
  }

  const challenge = await fetchSep10Challenge({
    webAuthEndpoint,
    account: input.account,
    memo: moneyGramMemo,
    // SEP-10 home_domain is the client (wallet) domain, not the anchor domain.
    homeDomain:
      isMoneyGram || shouldSendSep10HomeDomain() ? input.clientDomain : undefined,
    clientDomain: input.clientDomain,
  });

  return {
    role: input.role,
    anchorId: input.anchor.id,
    anchorName: input.anchor.name,
    domain: executionDomain,
    assetCode: effectiveAssetCode,
    assetIssuer: effectiveAssetIssuer,
    amount: input.amount,
    account: input.account,
    webAuthEndpoint,
    transferServerSep24,
    challengeXdr: challenge.challengeXdr,
    networkPassphrase: challenge.networkPassphrase,
  };
}

function clonePreparedAnchorWithRole(
  base: PreparedAnchorAuth,
  role: "origin" | "destination",
  assetCode?: string
): PreparedAnchorAuth {
  return {
    ...base,
    role,
    assetCode: assetCode ?? base.assetCode,
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
      const anchors = await listActiveAnchors();
      const originAnchor = findAnchorById(anchors, asString(route.originAnchor?.id));
      const destinationAnchor = findAnchorById(
        anchors,
        asString(route.destinationAnchor?.id)
      );
      const routeUsesMoneyGram =
        isMoneyGramDomain(originAnchor.domain) ||
        isMoneyGramDomain(destinationAnchor.domain);
      const mustSendClientDomain =
        shouldSendSep10ClientDomain() || routeUsesMoneyGram;
      if (mustSendClientDomain && !clientDomain) {
        return res.status(400).json({
          error:
            "Unable to resolve client_domain for SEP-10. Set SEP10_CLIENT_DOMAIN in API env.",
        });
      }
      if (
        mustSendClientDomain &&
        getPopEnv() === "production" &&
        isLocalDomain(clientDomain)
      ) {
        return res.status(400).json({
          error:
            "Invalid SEP10_CLIENT_DOMAIN for production. Use a public domain, not localhost.",
        });
      }
      if (
        mustSendClientDomain &&
        (shouldSignClientDomainForAnchor(originAnchor.domain) ||
          shouldSignClientDomainForAnchor(destinationAnchor.domain)) &&
        !getClientDomainSigningSecret()
      ) {
        return res.status(400).json({
          error:
            "Missing SEP10_CLIENT_DOMAIN_SIGNING_SECRET. Required for client_domain authentication with selected anchor(s).",
        });
      }
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

      const originAssetCode =
        asString(route.originCurrency) || originAnchor.currency;
      const destinationAssetCode =
        asString(route.destinationCurrency) || destinationAnchor.currency;
      const preparedAnchors = await Promise.all([
        prepareAnchorAuth({
          role: "origin",
          anchor: originAnchor,
          assetCode: originAssetCode,
          amount,
          account: senderAccount,
          clientDomain: mustSendClientDomain
            ? clientDomain
            : undefined,
        }),
        prepareAnchorAuth({
          role: "destination",
          anchor: destinationAnchor,
          assetCode: destinationAssetCode,
          amount,
          account: senderAccount,
          clientDomain: mustSendClientDomain
            ? clientDomain
            : undefined,
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
          clientDomain: mustSendClientDomain ? clientDomain : undefined,
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
    const sep10TokenByChallenge = new Map<string, string>();
    const callbackToken = randomBytes(18).toString("hex");
    const callbackUrl = buildCallbackUrl(req, prepared.transactionId, callbackToken);

    for (const anchor of prepared.anchors) {
      const signedChallengeXdr = asString(signatures[anchor.role]);
      if (!signedChallengeXdr) {
        return res.status(400).json({ error: `Missing signature for role '${anchor.role}'` });
      }
      const signedWithClientDomain = signClientDomainChallenge({
        transactionXdr: signedChallengeXdr,
        networkPassphrase: anchor.networkPassphrase,
        anchorDomain: anchor.domain,
      });

      const tokenCacheKey = `${anchor.webAuthEndpoint}|${signedWithClientDomain}`;
      let token = sep10TokenByChallenge.get(tokenCacheKey);
      if (!token) {
        token = await exchangeSep10Token({
          webAuthEndpoint: anchor.webAuthEndpoint,
          signedChallengeXdr: signedWithClientDomain,
        });
        sep10TokenByChallenge.set(tokenCacheKey, token);
      }

      const operation = anchor.role === "origin" ? "deposit" : "withdraw";
      const interactive = await startSep24Interactive({
        transferServerSep24: anchor.transferServerSep24,
        token,
        operation,
        assetCode: anchor.assetCode,
        assetIssuer: anchor.assetIssuer,
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
