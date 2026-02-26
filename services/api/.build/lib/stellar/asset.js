const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_DIRECTORY_URL = process.env.STELLAR_ANCHOR_DIRECTORY_URL?.trim() ?? "";
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function toHost(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return "";
    try {
        const withProtocol = /^https?:\/\//i.test(trimmed)
            ? trimmed
            : `https://${trimmed}`;
        return new URL(withProtocol).hostname.toLowerCase();
    }
    catch {
        return trimmed
            .replace(/^https?:\/\//i, "")
            .replace(/\/.*$/, "")
            .toLowerCase();
    }
}
function parseHostFromUrl(value) {
    if (!value.trim())
        return "";
    try {
        return new URL(value).hostname.toLowerCase();
    }
    catch {
        return "";
    }
}
function normalizeDomainList(values) {
    return [...new Set(values.map(toHost).filter(Boolean))];
}
function toId(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}
function pickString(obj, keys) {
    for (const key of keys) {
        const value = obj[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
}
function toArray(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean);
    }
    if (typeof value === "string") {
        return value
            .split(/[;,|]/g)
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [];
}
function normalizeCountryCode(value) {
    const code = value.trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : "";
}
function normalizeCurrencyCode(value) {
    const code = value.trim().toUpperCase();
    return /^[A-Z0-9]{2,12}$/.test(code) ? code : "";
}
function inferRampTypes(record) {
    const rawType = pickString(record, [
        "type",
        "ramp_type",
        "direction",
        "flow",
        "service_type",
    ]).toLowerCase();
    const supportsDeposit = record.supports_deposit === true;
    const supportsWithdraw = record.supports_withdraw === true;
    if (rawType.includes("both") || rawType.includes("two-way")) {
        return ["on-ramp", "off-ramp"];
    }
    if (rawType.includes("off") || rawType.includes("withdraw")) {
        return ["off-ramp"];
    }
    if (rawType.includes("on") || rawType.includes("deposit")) {
        return ["on-ramp"];
    }
    if (supportsDeposit && supportsWithdraw) {
        return ["on-ramp", "off-ramp"];
    }
    if (supportsDeposit) {
        return ["on-ramp"];
    }
    if (supportsWithdraw) {
        return ["off-ramp"];
    }
    return ["on-ramp", "off-ramp"];
}
function dedupe(values) {
    return [...new Set(values)];
}
function parseCsvLine(line) {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
            if (quoted && line[i + 1] === '"') {
                current += '"';
                i += 1;
            }
            else {
                quoted = !quoted;
            }
            continue;
        }
        if (char === "," && !quoted) {
            cells.push(current.trim());
            current = "";
            continue;
        }
        current += char;
    }
    cells.push(current.trim());
    return cells;
}
function parseCsvRecords(text) {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length < 2)
        return [];
    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    return lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] ?? "";
        });
        return row;
    });
}
function extractRows(payload) {
    if (Array.isArray(payload)) {
        return payload.filter(isRecord);
    }
    if (!isRecord(payload)) {
        return [];
    }
    const candidates = [
        payload.anchors,
        payload.data,
        payload.items,
        payload.results,
    ];
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate.filter(isRecord);
        }
    }
    return [];
}
async function fetchDirectoryPayload(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json, text/csv, text/plain" },
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`Anchor directory fetch failed (${response.status} ${response.statusText})`);
        }
        const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
        const raw = await response.text();
        const trimmed = raw.trimStart().toLowerCase();
        if (contentType.includes("text/html") ||
            trimmed.startsWith("<!doctype html") ||
            trimmed.startsWith("<html")) {
            throw new Error("Anchor directory URL returned HTML. Provide a JSON/CSV export URL, not the directory homepage.");
        }
        if (contentType.includes("json")) {
            return JSON.parse(raw);
        }
        try {
            return JSON.parse(raw);
        }
        catch {
            return parseCsvRecords(raw);
        }
    }
    finally {
        clearTimeout(timer);
    }
}
function normalizeRow(row, active) {
    const name = pickString(row, ["name", "anchor_name", "organization", "org"]) || "Unknown";
    const domain = toHost(pickString(row, ["domain", "home_domain", "homeDomain", "website", "url"]));
    if (!domain)
        return [];
    const countryCandidates = dedupe([
        ...toArray(row.country),
        ...toArray(row.countries),
        ...toArray(row.country_code),
        ...toArray(row.country_codes),
        ...toArray(row.countryCode),
    ]
        .map(normalizeCountryCode)
        .filter(Boolean));
    const currencyCandidates = dedupe([
        ...toArray(row.currency),
        ...toArray(row.currencies),
        ...toArray(row.currency_code),
        ...toArray(row.currency_codes),
        ...toArray(row.asset_code),
        ...toArray(row.asset_codes),
    ]
        .map(normalizeCurrencyCode)
        .filter(Boolean));
    if (!countryCandidates.length || !currencyCandidates.length) {
        return [];
    }
    const types = inferRampTypes(row);
    const results = [];
    for (const type of types) {
        for (const country of countryCandidates) {
            for (const currency of currencyCandidates) {
                const id = toId(`anchor-${domain}-${country}-${currency}-${type}`);
                results.push({
                    id,
                    name,
                    domain,
                    country,
                    currency,
                    type,
                    active,
                });
            }
        }
    }
    return results;
}
export async function loadAnchorDirectory(input) {
    const active = input.active ?? true;
    const sourceUrl = input.downloadUrl?.trim() || DEFAULT_DIRECTORY_URL;
    let rowsSource = [];
    let source = "request-body";
    let strategy;
    let sourceHint;
    let payloadDirectoryDomains = [];
    if (Array.isArray(input.anchors)) {
        rowsSource = input.anchors.filter(isRecord);
    }
    else if (sourceUrl) {
        const payload = await fetchDirectoryPayload(sourceUrl, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        rowsSource = extractRows(payload);
        source = sourceUrl;
        if (isRecord(payload)) {
            strategy =
                typeof payload.strategy === "string" ? payload.strategy.trim() : undefined;
            sourceHint =
                typeof payload.source === "string" ? payload.source.trim() : undefined;
            if (Array.isArray(payload.directoryDomains)) {
                payloadDirectoryDomains = normalizeDomainList(payload.directoryDomains.filter((d) => typeof d === "string"));
            }
        }
        if (!rowsSource.length) {
            throw new Error("No anchor rows found in source payload. Expected JSON/CSV with anchors/data/items/results arrays.");
        }
    }
    else {
        throw new Error("Provide anchors[] in body or configure STELLAR_ANCHOR_DIRECTORY_URL/downloadUrl.");
    }
    const sourceHost = parseHostFromUrl(sourceUrl);
    const sourceHintHost = parseHostFromUrl(sourceHint ?? "");
    const normalizedStrategy = (strategy ?? "").toLowerCase();
    if (input.rejectHorizonStrategy !== false && normalizedStrategy.includes("horizon")) {
        throw new Error("Rejected source payload strategy: horizon");
    }
    if (input.requireDirectoryProvenance) {
        const isStellarDomain = sourceHost === "anchors.stellar.org" ||
            sourceHost.endsWith(".stellar.org");
        const hasDirectoryHint = sourceHintHost === "anchors.stellar.org" ||
            sourceHintHost.endsWith(".stellar.org");
        const strategyLooksDirectory = normalizedStrategy.includes("directory") ||
            normalizedStrategy.includes("playwright");
        if (!isStellarDomain && !hasDirectoryHint && !strategyLooksDirectory) {
            throw new Error("Directory provenance check failed. Source must come from anchors.stellar.org discovery/export.");
        }
    }
    const allowedDomains = normalizeDomainList(input.allowedDomains?.length ? input.allowedDomains : payloadDirectoryDomains);
    if (input.requireAllowedDomains && allowedDomains.length === 0) {
        throw new Error("Allowed domain list is required (allowedDomains[] or payload.directoryDomains[])");
    }
    const deduped = new Map();
    let skipped = 0;
    let rejectedByDomain = 0;
    for (const row of rowsSource) {
        const normalizedRows = normalizeRow(row, active);
        if (!normalizedRows.length) {
            skipped += 1;
            continue;
        }
        for (const normalized of normalizedRows) {
            if (allowedDomains.length > 0 && !allowedDomains.includes(normalized.domain)) {
                rejectedByDomain += 1;
                continue;
            }
            deduped.set(normalized.id, normalized);
        }
    }
    return {
        rows: [...deduped.values()],
        source,
        skipped,
        rejectedByDomain,
        allowedDomains,
        provenance: {
            strategy,
            sourceHint,
        },
    };
}
