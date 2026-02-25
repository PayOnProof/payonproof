import type { ResolvedAnchorCapabilities } from "./capabilities.js";

export interface AnchorTrustInput {
  domain: string;
  capabilities: ResolvedAnchorCapabilities;
  requireSep10?: boolean;
  requireSigningKey?: boolean;
  requireSep24OrSep31?: boolean;
}

export interface AnchorTrustResult {
  trusted: boolean;
  reasons: string[];
}

function isHttpsUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function evaluateAnchorTrust(input: AnchorTrustInput): AnchorTrustResult {
  const reasons: string[] = [];
  const c = input.capabilities;
  const requireSep10 = input.requireSep10 ?? true;
  const requireSigningKey = input.requireSigningKey ?? true;
  const requireSep24OrSep31 = input.requireSep24OrSep31 ?? true;
  const raw = c.raw as Record<string, unknown> | undefined;
  const signingKey =
    raw && typeof raw === "object"
      ? typeof (raw as Record<string, unknown>).signingKey === "string"
        ? ((raw as Record<string, unknown>).signingKey as string)
        : undefined
      : undefined;

  if (!c.sep.sep24 && !c.sep.sep6 && !c.sep.sep31) {
    reasons.push("Anchor missing transfer protocol capability (SEP-24/6/31)");
  }
  if (requireSep24OrSep31 && !c.sep.sep24 && !c.sep.sep31) {
    reasons.push("Anchor missing SEP-24/SEP-31 (SEP-6 only is not allowed)");
  }

  if (requireSigningKey && !signingKey) {
    reasons.push("Missing SIGNING_KEY in stellar.toml");
  }

  if (requireSep10) {
    if (!c.sep.sep10) {
      reasons.push("Missing SEP-10 (WEB_AUTH_ENDPOINT)");
    } else if (!isHttpsUrl(c.endpoints.webAuthEndpoint)) {
      reasons.push("Invalid WEB_AUTH_ENDPOINT (must be HTTPS)");
    }
  } else if (c.sep.sep10 && !isHttpsUrl(c.endpoints.webAuthEndpoint)) {
    reasons.push("Invalid WEB_AUTH_ENDPOINT (must be HTTPS)");
  }

  if (c.sep.sep24 && !isHttpsUrl(c.endpoints.transferServerSep24)) {
    reasons.push("Invalid TRANSFER_SERVER_SEP0024 (must be HTTPS)");
  }
  if (c.sep.sep6 && !isHttpsUrl(c.endpoints.transferServerSep6)) {
    reasons.push("Invalid TRANSFER_SERVER (must be HTTPS)");
  }
  if (c.sep.sep31 && !isHttpsUrl(c.endpoints.directPaymentServer)) {
    reasons.push("Invalid DIRECT_PAYMENT_SERVER (must be HTTPS)");
  }

  return {
    trusted: reasons.length === 0,
    reasons,
  };
}
