import { discoverAnchorFromDomain } from "./sep1.ts";
import { fetchSep24Info } from "./sep24.ts";
import { fetchSep6Info } from "./sep6.ts";
import type { AnchorCatalogImportRow } from "./anchor-directory.ts";

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_HORIZON_URL =
  process.env.STELLAR_HORIZON_URL?.trim() ?? "https://horizon.stellar.org";

interface HorizonAssetRecord {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}

interface HorizonAccountRecord {
  id: string;
  home_domain?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function toId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const size = Math.max(1, Math.floor(concurrency));

  async function runOne() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: size }, () => runOne()));
  return results;
}

function deriveCountryFromDomain(domain: string): string {
  const parts = domain.toLowerCase().split(".");
  const tld = parts[parts.length - 1] ?? "";
  if (/^[a-z]{2}$/.test(tld)) return tld.toUpperCase();
  return "ZZ";
}

function pickAnchorName(domain: string, info: unknown): string {
  if (info && typeof info === "object") {
    const root = info as Record<string, unknown>;
    const orgName = root.org_name;
    const name = root.name;
    if (typeof orgName === "string" && orgName.trim()) return orgName.trim();
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return domain;
}

function normalizeCountryCode(value: unknown): string {
  if (typeof value !== "string") return "";
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

function extractCountryCodesFromAssetConfig(assetConfig: unknown): string[] {
  if (!assetConfig || typeof assetConfig !== "object") return [];
  const cfg = assetConfig as Record<string, unknown>;
  const result = new Set<string>();

  const direct = [
    cfg.country,
    cfg.country_code,
    cfg.countryCode,
    cfg.countries,
    cfg.country_codes,
  ];
  for (const value of direct) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const code = normalizeCountryCode(item);
        if (code) result.add(code);
      }
    } else {
      const code = normalizeCountryCode(value);
      if (code) result.add(code);
    }
  }

  const fields =
    cfg.fields && typeof cfg.fields === "object"
      ? (cfg.fields as Record<string, unknown>)
      : undefined;
  if (fields) {
    const cc =
      (fields.country_code as Record<string, unknown> | undefined) ??
      (fields.countryCode as Record<string, unknown> | undefined);
    const choices = cc?.choices;
    if (Array.isArray(choices)) {
      for (const item of choices) {
        const code = normalizeCountryCode(item);
        if (code) result.add(code);
      }
    }
  }

  return [...result];
}

function extractTypesAndCurrencies(info: unknown): Array<{
  type: "on-ramp" | "off-ramp";
  currency: string;
  countries: string[];
}> {
  if (!info || typeof info !== "object") return [];
  const root = info as Record<string, unknown>;
  const deposit =
    root.deposit && typeof root.deposit === "object"
      ? (root.deposit as Record<string, unknown>)
      : {};
  const withdraw =
    root.withdraw && typeof root.withdraw === "object"
      ? (root.withdraw as Record<string, unknown>)
      : {};

  const rows: Array<{
    type: "on-ramp" | "off-ramp";
    currency: string;
    countries: string[];
  }> = [];

  for (const code of Object.keys(deposit)) {
    const assetCode = code.split(":")[0]?.trim().toUpperCase();
    if (assetCode && /^[A-Z0-9]{2,12}$/.test(assetCode)) {
      rows.push({
        type: "on-ramp",
        currency: assetCode,
        countries: extractCountryCodesFromAssetConfig(deposit[code]),
      });
    }
  }
  for (const code of Object.keys(withdraw)) {
    const assetCode = code.split(":")[0]?.trim().toUpperCase();
    if (assetCode && /^[A-Z0-9]{2,12}$/.test(assetCode)) {
      rows.push({
        type: "off-ramp",
        currency: assetCode,
        countries: extractCountryCodesFromAssetConfig(withdraw[code]),
      });
    }
  }

  const dedup = new Map<
    string,
    { type: "on-ramp" | "off-ramp"; currency: string; countries: string[] }
  >();
  for (const row of rows) {
    const key = `${row.type}:${row.currency}`;
    const current = dedup.get(key);
    if (!current) {
      dedup.set(key, row);
      continue;
    }
    const merged = new Set([...(current.countries ?? []), ...(row.countries ?? [])]);
    dedup.set(key, { ...current, countries: [...merged] });
  }
  return [...dedup.values()];
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`${url} -> ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

async function getAssetIssuersFromHorizon(input: {
  horizonUrl: string;
  assetPages: number;
  assetsPerPage: number;
  timeoutMs: number;
}): Promise<Set<string>> {
  const issuers = new Set<string>();
  let nextUrl =
    `${normalizeBaseUrl(input.horizonUrl)}/assets?limit=${input.assetsPerPage}&order=desc`;

  for (let page = 0; page < input.assetPages; page += 1) {
    const payload = (await fetchJsonWithTimeout(nextUrl, input.timeoutMs)) as {
      _embedded?: { records?: HorizonAssetRecord[] };
      _links?: { next?: { href?: string } };
    };
    const records = payload?._embedded?.records ?? [];
    if (records.length === 0) break;

    for (const record of records) {
      if (record.asset_type === "native") continue;
      if (record.asset_issuer) issuers.add(record.asset_issuer);
    }

    const href = payload?._links?.next?.href;
    if (!href || typeof href !== "string") break;
    nextUrl = href;
  }

  return issuers;
}

async function getHomeDomainForIssuer(input: {
  horizonUrl: string;
  issuer: string;
  timeoutMs: number;
}): Promise<string | undefined> {
  const url = `${normalizeBaseUrl(input.horizonUrl)}/accounts/${input.issuer}`;
  const payload = (await fetchJsonWithTimeout(url, input.timeoutMs)) as HorizonAccountRecord;
  const homeDomain = payload.home_domain?.trim().toLowerCase();
  return homeDomain || undefined;
}

export async function discoverAnchorsFromHorizon(input?: {
  horizonUrl?: string;
  assetPages?: number;
  assetsPerPage?: number;
  issuerLimit?: number;
  issuerConcurrency?: number;
  domainConcurrency?: number;
  timeoutMs?: number;
}): Promise<{
  rows: AnchorCatalogImportRow[];
  stats: {
    issuersScanned: number;
    domainsDiscovered: number;
    domainsWithSep: number;
  };
}> {
  const horizonUrl = input?.horizonUrl?.trim() || DEFAULT_HORIZON_URL;
  const assetPages = Math.max(1, Math.min(10, Math.floor(input?.assetPages ?? 4)));
  const assetsPerPage = Math.max(20, Math.min(200, Math.floor(input?.assetsPerPage ?? 200)));
  const issuerLimit = Math.max(10, Math.min(1000, Math.floor(input?.issuerLimit ?? 250)));
  const issuerConcurrency = Math.max(
    1,
    Math.min(50, Math.floor(input?.issuerConcurrency ?? 20))
  );
  const domainConcurrency = Math.max(
    1,
    Math.min(30, Math.floor(input?.domainConcurrency ?? 8))
  );
  const timeoutMs = Math.max(3000, Math.min(20000, Math.floor(input?.timeoutMs ?? DEFAULT_TIMEOUT_MS)));

  const issuers = await getAssetIssuersFromHorizon({
    horizonUrl,
    assetPages,
    assetsPerPage,
    timeoutMs,
  });

  const issuerList = [...issuers].slice(0, issuerLimit);
  const domains = new Set<string>();
  const discoveredHomeDomains = await mapWithConcurrency(
    issuerList,
    issuerConcurrency,
    async (issuer) => {
      try {
        return await getHomeDomainForIssuer({ horizonUrl, issuer, timeoutMs });
      } catch {
        return undefined;
      }
    }
  );
  for (const homeDomain of discoveredHomeDomains) {
    if (homeDomain) domains.add(homeDomain);
  }

  const rows = new Map<string, AnchorCatalogImportRow>();
  let domainsWithSep = 0;

  const domainList = [...domains];
  const domainRows = await mapWithConcurrency(
    domainList,
    domainConcurrency,
    async (domain) => {
      try {
        const sep1 = await discoverAnchorFromDomain({ domain, timeoutMs });
        const country = deriveCountryFromDomain(sep1.domain);

        let sep24Info: unknown;
        let sep6Info: unknown;
        if (sep1.transferServerSep24) {
          try {
            sep24Info = (
              await fetchSep24Info({
                transferServerSep24: sep1.transferServerSep24,
                timeoutMs,
              })
            ).info;
          } catch {
            // ignore
          }
        }
        if (sep1.transferServerSep6) {
          try {
            sep6Info = (
              await fetchSep6Info({
                transferServerSep6: sep1.transferServerSep6,
                timeoutMs,
              })
            ).info;
          } catch {
            // ignore
          }
        }

        const extracted = [
          ...extractTypesAndCurrencies(sep24Info),
          ...extractTypesAndCurrencies(sep6Info),
        ];
        const dedup = new Map<
          string,
          { type: "on-ramp" | "off-ramp"; currency: string; countries: string[] }
        >();
        for (const row of extracted) dedup.set(`${row.type}:${row.currency}`, row);
        const capabilities = [...dedup.values()];
        if (capabilities.length === 0) return { hasSep: false, rows: [] as AnchorCatalogImportRow[] };

        const anchorName = pickAnchorName(sep1.domain, sep24Info ?? sep6Info);
        const out: AnchorCatalogImportRow[] = capabilities.flatMap((capability) => {
          const countries = capability.countries.length
            ? capability.countries
            : [country];
          return countries.map((countryCode) => {
            const id = toId(
              `anchor-${sep1.domain}-${countryCode}-${capability.currency}-${capability.type}`
            );
            return {
              id,
              name: anchorName,
              domain: sep1.domain,
              country: countryCode,
              currency: capability.currency,
              type: capability.type,
              active: true,
            };
          });
        });
        return { hasSep: true, rows: out };
      } catch {
        return { hasSep: false, rows: [] as AnchorCatalogImportRow[] };
      }
    }
  );

  for (const result of domainRows) {
    if (result.hasSep) domainsWithSep += 1;
    for (const row of result.rows) {
      rows.set(row.id, row);
    }
  }

  return {
    rows: [...rows.values()],
    stats: {
      issuersScanned: issuerList.length,
      domainsDiscovered: domains.size,
      domainsWithSep,
    },
  };
}
