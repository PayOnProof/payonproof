import { discoverAnchorFromDomain } from "./sep1.js";
const DEFAULT_TIMEOUT_MS = 8000;
async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });
    }
    finally {
        clearTimeout(timer);
    }
}
function normalizeBaseUrl(url) {
    return url.trim().replace(/\/+$/, "");
}
export async function fetchSep24Info(input) {
    let transferServer = input.transferServerSep24?.trim();
    let domain = input.domain?.trim();
    if (!transferServer) {
        if (!domain) {
            throw new Error("Either transferServerSep24 or domain is required to fetch SEP-24 info");
        }
        const discovered = await discoverAnchorFromDomain({ domain });
        transferServer = discovered.transferServerSep24;
        domain = discovered.domain;
    }
    if (!transferServer) {
        throw new Error("TRANSFER_SERVER_SEP0024 not found in stellar.toml");
    }
    const transferServerSep24 = normalizeBaseUrl(transferServer);
    const infoUrl = `${transferServerSep24}/info`;
    const response = await fetchWithTimeout(infoUrl, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (!response.ok) {
        throw new Error(`Failed to load SEP-24 /info (${response.status} ${response.statusText})`);
    }
    const info = (await response.json());
    return { infoUrl, transferServerSep24, domain, info };
}
