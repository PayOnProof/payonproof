import { Keypair, TransactionBuilder, WebAuth } from "@stellar/stellar-sdk";
import { discoverAnchorFromDomain } from "./sep1";
import { getStellarConfig } from "../stellar";

const DEFAULT_TIMEOUT_MS = 8000;

export interface Sep10TokenInput {
  domain?: string;
  webAuthEndpoint?: string;
  serverSigningKey?: string;
  secretKey: string;
  accountPublicKey?: string;
  homeDomain?: string;
  clientDomain?: string;
  timeoutMs?: number;
}

export interface Sep10TokenResult {
  domain?: string;
  webAuthEndpoint: string;
  account: string;
  token: string;
  expiresAt?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function appendQuery(url: string, key: string, value?: string): string {
  if (!value) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(
    value
  )}`;
}

export async function requestSep10Token(
  input: Sep10TokenInput
): Promise<Sep10TokenResult> {
  let domain = input.domain?.trim();
  let webAuthEndpoint = input.webAuthEndpoint?.trim();
  let serverSigningKey = input.serverSigningKey?.trim();

  if (!webAuthEndpoint) {
    if (!domain) {
      throw new Error("Provide domain or webAuthEndpoint");
    }
    const discovered = await discoverAnchorFromDomain({ domain });
    webAuthEndpoint = discovered.webAuthEndpoint;
    domain = discovered.domain;
    serverSigningKey = serverSigningKey || discovered.signingKey;
  } else if (!serverSigningKey && domain) {
    const discovered = await discoverAnchorFromDomain({ domain });
    domain = discovered.domain;
    serverSigningKey = discovered.signingKey;
  }

  if (!webAuthEndpoint) {
    throw new Error("WEB_AUTH_ENDPOINT not found in stellar.toml");
  }
  if (!serverSigningKey) {
    throw new Error(
      "Missing SIGNING_KEY for SEP-10 verification. Provide domain or serverSigningKey."
    );
  }

  const keypair = Keypair.fromSecret(input.secretKey.trim());
  const account = input.accountPublicKey?.trim() || keypair.publicKey();

  const authBase = normalizeBaseUrl(webAuthEndpoint);
  let challengeUrl = appendQuery(authBase, "account", account);
  challengeUrl = appendQuery(challengeUrl, "home_domain", input.homeDomain);
  challengeUrl = appendQuery(challengeUrl, "client_domain", input.clientDomain);

  const challengeRes = await fetchWithTimeout(
    challengeUrl,
    { method: "GET", headers: { Accept: "application/json" } },
    input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  if (!challengeRes.ok) {
    const body = await challengeRes.text();
    throw new Error(
      `SEP-10 challenge failed (${challengeRes.status}): ${body || challengeRes.statusText}`
    );
  }

  const challengeJson = (await challengeRes.json()) as {
    transaction?: string;
    network_passphrase?: string;
  };

  if (!challengeJson.transaction) {
    throw new Error("SEP-10 challenge response missing transaction");
  }

  const networkPassphrase =
    challengeJson.network_passphrase || getStellarConfig().networkPassphrase;
  const expectedHomeDomain = input.homeDomain?.trim() || domain;
  if (!expectedHomeDomain) {
    throw new Error(
      "Missing expected home domain for SEP-10 verification. Provide domain or homeDomain."
    );
  }
  const expectedWebAuthDomain = new URL(authBase).hostname.toLowerCase();

  const { clientAccountID } = WebAuth.readChallengeTx(
    challengeJson.transaction,
    serverSigningKey,
    networkPassphrase,
    expectedHomeDomain,
    expectedWebAuthDomain
  );
  if (clientAccountID !== account) {
    throw new Error("SEP-10 challenge account mismatch");
  }

  const tx = TransactionBuilder.fromXDR(
    challengeJson.transaction,
    networkPassphrase
  );
  tx.sign(keypair);
  const signedTx = tx.toEnvelope().toXDR("base64");

  const tokenRes = await fetchWithTimeout(
    authBase,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ transaction: signedTx }),
    },
    input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(
      `SEP-10 token request failed (${tokenRes.status}): ${body || tokenRes.statusText}`
    );
  }

  const tokenJson = (await tokenRes.json()) as {
    token?: string;
    expires_at?: string;
  };

  if (!tokenJson.token) {
    throw new Error("SEP-10 token response missing token");
  }

  return {
    domain,
    webAuthEndpoint: authBase,
    account,
    token: tokenJson.token,
    expiresAt: tokenJson.expires_at,
  };
}
