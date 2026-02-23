type AnchorRampType = "on-ramp" | "off-ramp";

export interface AnchorCatalogImportRow {
  id: string;
  name: string;
  domain: string;
  country: string;
  currency: string;
  type: AnchorRampType;
  active: boolean;
}

export interface AnchorDirectoryLoadInput {
  downloadUrl?: string;
  anchors?: unknown[];
  active?: boolean;
  timeoutMs?: number;
}

export interface AnchorDirectoryLoadResult {
  rows: AnchorCatalogImportRow[];
  source: string;
  skipped: number;
}

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_DIRECTORY_URL =
  process.env.STELLAR_ANCHOR_DIRECTORY_URL?.trim() ?? "";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toHost(value: string): string {
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

function toId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function toArray(value: unknown): string[] {
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

function normalizeCountryCode(value: string): string {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

function normalizeCurrencyCode(value: string): string {
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,12}$/.test(code) ? code : "";
}

function inferRampTypes(record: Record<string, unknown>): AnchorRampType[] {
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

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
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

function parseCsvRecords(text: string): Record<string, unknown>[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function extractRows(payload: unknown): Record<string, unknown>[] {
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

async function fetchDirectoryPayload(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json, text/csv, text/plain" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Anchor directory fetch failed (${response.status} ${response.statusText})`
      );
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const raw = await response.text();
    const trimmed = raw.trimStart().toLowerCase();

    if (
      contentType.includes("text/html") ||
      trimmed.startsWith("<!doctype html") ||
      trimmed.startsWith("<html")
    ) {
      throw new Error(
        "Anchor directory URL returned HTML. Provide a JSON/CSV export URL, not the directory homepage."
      );
    }

    if (contentType.includes("json")) {
      return JSON.parse(raw);
    }

    try {
      return JSON.parse(raw);
    } catch {
      return parseCsvRecords(raw);
    }
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRow(
  row: Record<string, unknown>,
  active: boolean
): AnchorCatalogImportRow[] {
  const name =
    pickString(row, ["name", "anchor_name", "organization", "org"]) || "Unknown";
  const domain = toHost(
    pickString(row, ["domain", "home_domain", "homeDomain", "website", "url"])
  );
  if (!domain) return [];

  const countryCandidates = dedupe(
    [
      ...toArray(row.country),
      ...toArray(row.countries),
      ...toArray(row.country_code),
      ...toArray(row.country_codes),
      ...toArray(row.countryCode),
    ]
      .map(normalizeCountryCode)
      .filter(Boolean)
  );

  const currencyCandidates = dedupe(
    [
      ...toArray(row.currency),
      ...toArray(row.currencies),
      ...toArray(row.currency_code),
      ...toArray(row.currency_codes),
      ...toArray(row.asset_code),
      ...toArray(row.asset_codes),
    ]
      .map(normalizeCurrencyCode)
      .filter(Boolean)
  );

  if (!countryCandidates.length || !currencyCandidates.length) {
    return [];
  }

  const types = inferRampTypes(row);
  const results: AnchorCatalogImportRow[] = [];

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

export async function loadAnchorDirectory(
  input: AnchorDirectoryLoadInput
): Promise<AnchorDirectoryLoadResult> {
  const active = input.active ?? true;
  const sourceUrl = input.downloadUrl?.trim() || DEFAULT_DIRECTORY_URL;

  let rowsSource: Record<string, unknown>[] = [];
  let source = "request-body";

  if (Array.isArray(input.anchors)) {
    rowsSource = input.anchors.filter(isRecord);
  } else if (sourceUrl) {
    const payload = await fetchDirectoryPayload(
      sourceUrl,
      input.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
    rowsSource = extractRows(payload);
    source = sourceUrl;
    if (!rowsSource.length) {
      throw new Error(
        "No anchor rows found in source payload. Expected JSON/CSV with anchors/data/items/results arrays."
      );
    }
  } else {
    throw new Error(
      "Provide anchors[] in body or configure STELLAR_ANCHOR_DIRECTORY_URL/downloadUrl."
    );
  }

  const deduped = new Map<string, AnchorCatalogImportRow>();
  let skipped = 0;

  for (const row of rowsSource) {
    const normalizedRows = normalizeRow(row, active);
    if (!normalizedRows.length) {
      skipped += 1;
      continue;
    }
    for (const normalized of normalizedRows) {
      deduped.set(normalized.id, normalized);
    }
  }

  return {
    rows: [...deduped.values()],
    source,
    skipped,
  };
}
