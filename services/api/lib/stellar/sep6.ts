import { discoverAnchorFromDomain } from "./sep1";

const DEFAULT_TIMEOUT_MS = 8000;

export interface Sep6InfoInput {
  domain?: string;
  transferServerSep6?: string;
  timeoutMs?: number;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSep6Info(input: Sep6InfoInput): Promise<{
  infoUrl: string;
  transferServerSep6: string;
  domain?: string;
  info: unknown;
}> {
  let transferServer = input.transferServerSep6?.trim();
  let domain = input.domain?.trim();

  if (!transferServer) {
    if (!domain) {
      throw new Error(
        "Either transferServerSep6 or domain is required to fetch SEP-6 info"
      );
    }

    const discovered = await discoverAnchorFromDomain({ domain });
    transferServer = discovered.transferServerSep6;
    domain = discovered.domain;
  }

  if (!transferServer) {
    throw new Error("TRANSFER_SERVER not found in stellar.toml");
  }

  const transferServerSep6 = normalizeBaseUrl(transferServer);
  const infoUrl = `${transferServerSep6}/info`;
  const response = await fetchWithTimeout(
    infoUrl,
    input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load SEP-6 /info (${response.status} ${response.statusText})`
    );
  }

  const info = (await response.json()) as unknown;
  return { infoUrl, transferServerSep6, domain, info };
}
