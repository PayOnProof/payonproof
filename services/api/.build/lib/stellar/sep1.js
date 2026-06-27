const DEFAULT_TIMEOUT_MS = 8000;
function normalizeDomain(input) {
    return input.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}
function parseTomlFlat(text) {
    const result = {};
    const lines = text.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || line.startsWith("[")) {
            continue;
        }
        const eqIdx = line.indexOf("=");
        if (eqIdx <= 0) {
            continue;
        }
        const key = line.slice(0, eqIdx).trim();
        let value = line.slice(eqIdx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }
        if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}
async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            method: "GET",
            headers: { Accept: "text/plain, text/x-toml, application/toml" },
            signal: controller.signal,
        });
    }
    finally {
        clearTimeout(timer);
    }
}
export async function discoverAnchorFromDomain(input) {
    const domain = normalizeDomain(input.domain);
    if (!domain) {
        throw new Error("domain is required");
    }
    const stellarTomlUrl = `https://${domain}/.well-known/stellar.toml`;
    const response = await fetchWithTimeout(stellarTomlUrl, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (!response.ok) {
        throw new Error(`Failed to load stellar.toml (${response.status} ${response.statusText})`);
    }
    const text = await response.text();
    const parsed = parseTomlFlat(text);
    return {
        domain,
        stellarTomlUrl,
        signingKey: parsed.SIGNING_KEY,
        webAuthEndpoint: parsed.WEB_AUTH_ENDPOINT,
        transferServerSep24: parsed.TRANSFER_SERVER_SEP0024,
        transferServerSep6: parsed.TRANSFER_SERVER,
        directPaymentServer: parsed.DIRECT_PAYMENT_SERVER,
        kycServer: parsed.KYC_SERVER,
        raw: parsed,
    };
}
