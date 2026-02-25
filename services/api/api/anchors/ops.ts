import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../../lib/http.js";
import { loadAnchorDirectory } from "../../lib/stellar/anchor-directory.js";
import {
  listActiveAnchors,
  setAnchorActive,
  updateAnchorCapabilities,
  upsertAnchorsCatalog,
} from "../../lib/repositories/anchors-catalog.js";
import { resolveAnchorCapabilities } from "../../lib/stellar/capabilities.js";
import { discoverAnchorsFromHorizon } from "../../lib/stellar/horizon.js";
import { evaluateAnchorTrust } from "../../lib/stellar/trust.js";

type OpsAction = "import_directory" | "refresh_capabilities" | "sync";

const DEFAULT_DIRECTORY_HOME = "https://anchors.stellar.org/";
const SEP1_404_COUNTER_PREFIX = "sep1_404_count:";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseAction(value: unknown): OpsAction | "" {
  const action = asString(value).toLowerCase();
  switch (action) {
    case "import_directory":
    case "refresh_capabilities":
    case "sync":
      return action;
    default:
      return "";
  }
}

function parseAllowedDomainsFromEnv(): string[] {
  const raw = process.env.ANCHOR_DIRECTORY_ALLOWED_DOMAINS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getQueryValue(req: VercelRequest, key: string): string | undefined {
  if (req.query && typeof req.query[key] === "string") {
    return (req.query[key] as string).trim();
  }
  const rawUrl = req.url ?? "";
  const query = rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?") + 1) : "";
  if (!query) return undefined;
  const params = new URLSearchParams(query);
  const value = params.get(key);
  return value?.trim() || undefined;
}

function parseLimit(input: string | undefined, fallback: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(1000, Math.floor(parsed)));
}

function parseSep1Counter(diagnostics: string[] | undefined): number {
  const marker = (diagnostics ?? []).find((d) => d.startsWith(SEP1_404_COUNTER_PREFIX));
  if (!marker) return 0;
  const value = Number(marker.slice(SEP1_404_COUNTER_PREFIX.length));
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function withoutSep1Counter(diagnostics: string[] | undefined): string[] {
  return (diagnostics ?? []).filter((d) => !d.startsWith(SEP1_404_COUNTER_PREFIX));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function toAbsolute(baseUrl: string, value: string): string {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function extractLinksFromHtml(baseUrl: string, html: string): string[] {
  const links: string[] = [];
  const hrefRegex = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const absolute = toAbsolute(baseUrl, match[1]);
    if (absolute) links.push(absolute);
  }

  return unique(links);
}

function findNextDataJson(html: string): unknown {
  const re =
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>\s*([\s\S]*?)\s*<\/script>/i;
  const m = html.match(re);
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function looksLikeAnchorRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const hasDomain =
    typeof row.domain === "string" ||
    typeof row.home_domain === "string" ||
    typeof row.homeDomain === "string" ||
    typeof row.website === "string" ||
    typeof row.url === "string";
  const hasMeta =
    Boolean(row.country) ||
    Boolean(row.countries) ||
    Boolean(row.country_code) ||
    Boolean(row.country_codes) ||
    Boolean(row.currency) ||
    Boolean(row.currencies) ||
    Boolean(row.asset_code) ||
    Boolean(row.asset_codes);
  return hasDomain && hasMeta;
}

function collectAnchorArrays(
  input: unknown,
  out: Array<Record<string, unknown>[]>,
  seen = new Set<unknown>()
) {
  if (!input || typeof input !== "object") return;
  if (seen.has(input)) return;
  seen.add(input);

  if (Array.isArray(input)) {
    if (input.length > 0 && input.every((row) => looksLikeAnchorRecord(row))) {
      out.push(input as Record<string, unknown>[]);
      return;
    }
    for (const item of input) {
      collectAnchorArrays(item, out, seen);
    }
    return;
  }

  for (const value of Object.values(input as Record<string, unknown>)) {
    collectAnchorArrays(value, out, seen);
  }
}

async function discoverFromAnchorsStellarOrg(homeUrl: string) {
  const response = await fetch(homeUrl, {
    method: "GET",
    headers: { Accept: "text/html,application/json,text/plain,text/csv" },
  });
  if (!response.ok) {
    throw new Error(`Anchor directory home unavailable (${response.status})`);
  }
  const html = await response.text();
  const origin = new URL(homeUrl).origin;
  const links = extractLinksFromHtml(homeUrl, html);

  const guessed = [
    `${origin}/anchors.json`,
    `${origin}/api/anchors`,
    `${origin}/api/v1/anchors`,
    `${origin}/api/directory/anchors`,
    `${origin}/directory/anchors.json`,
    `${origin}/exports/anchors.json`,
  ];
  const candidates = unique([
    ...links.filter((u) => /\.(json|csv)(\?|$)/i.test(u)),
    ...links.filter((u) => /anchor|directory|export/i.test(u)),
    ...guessed,
  ]);

  for (const url of candidates) {
    try {
      const loaded = await loadAnchorDirectory({
        downloadUrl: url,
        active: true,
        requireDirectoryProvenance: true,
        rejectHorizonStrategy: true,
      });
      if (loaded.rows.length > 0) return loaded;
    } catch {
      // continue discovery
    }
  }

  const nextData = findNextDataJson(html);
  if (nextData) {
    const arrays: Array<Record<string, unknown>[]> = [];
    collectAnchorArrays(nextData, arrays);
    if (arrays.length > 0) {
      const best = arrays.sort((a, b) => b.length - a.length)[0];
      const loaded = await loadAnchorDirectory({
        anchors: best as unknown[],
        active: true,
        rejectHorizonStrategy: true,
      });
      if (loaded.rows.length > 0) {
        return { ...loaded, source: `${homeUrl}#__NEXT_DATA__` };
      }
    }
  }

  throw new Error(
    "Could not auto-discover a machine-readable anchors source from anchors.stellar.org"
  );
}

function isCronAuthorized(req: VercelRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  const querySecret = getQueryValue(req, "secret");
  const cronHeader = req.headers["x-vercel-cron"];
  const headerValue = Array.isArray(cronHeader) ? cronHeader[0] : cronHeader;

  if (configuredSecret) return configuredSecret === querySecret;
  return Boolean(headerValue) || process.env.NODE_ENV !== "production";
}

async function handleImportDirectory(body: Record<string, unknown>, res: VercelResponse) {
  const dryRun = body.dryRun !== false;
  const active = body.active !== false;
  const downloadUrl = asString(body.downloadUrl) || undefined;
  const anchors = Array.isArray(body.anchors) ? body.anchors : undefined;
  const strictDirectory = body.strictDirectory !== false;
  const bodyAllowedDomains = Array.isArray(body.allowedDomains)
    ? body.allowedDomains.filter((d): d is string => typeof d === "string")
    : [];
  const allowedDomains =
    bodyAllowedDomains.length > 0 ? bodyAllowedDomains : parseAllowedDomainsFromEnv();
  const requireAllowedDomains = strictDirectory && Boolean(downloadUrl);

  const loaded = await loadAnchorDirectory({
    downloadUrl,
    anchors,
    active,
    allowedDomains,
    requireAllowedDomains,
    requireDirectoryProvenance: strictDirectory && Boolean(downloadUrl),
    rejectHorizonStrategy: strictDirectory,
  });

  const written = dryRun ? 0 : await upsertAnchorsCatalog(loaded.rows);

  return res.status(200).json({
    status: "ok",
    action: "import_directory",
    dryRun,
    source: loaded.source,
    totalNormalized: loaded.rows.length,
    skippedSourceRows: loaded.skipped,
    rejectedByDomain: loaded.rejectedByDomain,
    allowedDomainsCount: loaded.allowedDomains.length,
    provenance: loaded.provenance,
    written,
    sample: loaded.rows.slice(0, 10),
  });
}

async function refreshCapabilities(input: {
  limit: number;
  country?: string;
  sep1DisableThreshold: number;
}) {
  const requireSep10 =
    String(process.env.ANCHOR_TRUST_REQUIRE_SEP10 ?? "true").toLowerCase() !== "false";
  const requireSigningKey =
    String(process.env.ANCHOR_TRUST_REQUIRE_SIGNING_KEY ?? "true").toLowerCase() !==
    "false";
  const requireSep24OrSep31 =
    String(process.env.ANCHOR_TRUST_REQUIRE_SEP24_OR_SEP31 ?? "true").toLowerCase() !==
    "false";

  const allAnchors = await listActiveAnchors();
  const candidates = allAnchors
    .filter((anchor) => (input.country ? anchor.country === input.country : true))
    .slice(0, input.limit);

  const results: Array<{
    id: string;
    domain: string;
    status: "ok" | "error";
    error?: string;
    autoDisabled?: boolean;
    sep1_404_count?: number;
  }> = [];

  for (const anchor of candidates) {
    try {
      const resolved = await resolveAnchorCapabilities({
        domain: anchor.domain,
        assetCode: anchor.currency,
      });

      await updateAnchorCapabilities({
        id: anchor.id,
        sep24: resolved.sep.sep24,
        sep6: resolved.sep.sep6,
        sep31: resolved.sep.sep31,
        sep10: resolved.sep.sep10,
        operational: resolved.sep.sep24 || resolved.sep.sep6 || resolved.sep.sep31,
        feeFixed: resolved.fees.fixed,
        feePercent: resolved.fees.percent,
        feeSource: resolved.fees.source,
        transferServerSep24: resolved.endpoints.transferServerSep24,
        transferServerSep6: resolved.endpoints.transferServerSep6,
        webAuthEndpoint: resolved.endpoints.webAuthEndpoint,
        directPaymentServer: resolved.endpoints.directPaymentServer,
        kycServer: resolved.endpoints.kycServer,
        diagnostics: resolved.diagnostics,
        lastCheckedAt: new Date().toISOString(),
      });

      const trust = evaluateAnchorTrust({
        domain: anchor.domain,
        capabilities: resolved,
        requireSep10,
        requireSigningKey,
        requireSep24OrSep31,
      });
      if (!trust.trusted) {
        await updateAnchorCapabilities({
          id: anchor.id,
          sep24: resolved.sep.sep24,
          sep6: resolved.sep.sep6,
          sep31: resolved.sep.sep31,
          sep10: resolved.sep.sep10,
          operational: false,
          feeFixed: resolved.fees.fixed,
          feePercent: resolved.fees.percent,
          feeSource: resolved.fees.source,
          transferServerSep24: resolved.endpoints.transferServerSep24,
          transferServerSep6: resolved.endpoints.transferServerSep6,
          webAuthEndpoint: resolved.endpoints.webAuthEndpoint,
          directPaymentServer: resolved.endpoints.directPaymentServer,
          kycServer: resolved.endpoints.kycServer,
          diagnostics: [
            ...resolved.diagnostics,
            ...trust.reasons.map((r) => `Trust policy: ${r}`),
          ],
          lastCheckedAt: new Date().toISOString(),
        });
        await setAnchorActive({ id: anchor.id, active: false });
        results.push({
          id: anchor.id,
          domain: anchor.domain,
          status: "error",
          error: `Untrusted anchor: ${trust.reasons.join("; ")}`,
          autoDisabled: true,
        });
        continue;
      }

      results.push({ id: anchor.id, domain: anchor.domain, status: "ok" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const isSep1NotFound = /stellar\.toml/i.test(message) && /\b404\b/i.test(message);
      const prev404Count = parseSep1Counter(anchor.capabilities.diagnostics);
      const next404Count = isSep1NotFound ? prev404Count + 1 : 0;
      let autoDisabled = false;

      try {
        await updateAnchorCapabilities({
          id: anchor.id,
          sep24: false,
          sep6: false,
          sep31: false,
          sep10: false,
          operational: false,
          diagnostics: [
            ...withoutSep1Counter(anchor.capabilities.diagnostics),
            `Capability resolution error: ${message}`,
            `${SEP1_404_COUNTER_PREFIX}${next404Count}`,
          ],
          lastCheckedAt: new Date().toISOString(),
        });

        if (isSep1NotFound && next404Count >= input.sep1DisableThreshold) {
          await setAnchorActive({ id: anchor.id, active: false });
          autoDisabled = true;
        }
      } catch {
        // best effort
      }

      results.push({
        id: anchor.id,
        domain: anchor.domain,
        status: "error",
        error: message,
        autoDisabled,
        sep1_404_count: isSep1NotFound ? next404Count : undefined,
      });
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const errors = results.length - ok;
  return { results, ok, errors, refreshed: results.length };
}

async function handleRefreshCapabilities(
  body: Record<string, unknown>,
  res: VercelResponse
) {
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.max(1, Math.min(500, Math.floor(body.limit)))
      : 100;
  const country = asString(body.country).toUpperCase() || undefined;
  const sep1DisableThreshold =
    typeof body.sep1DisableThreshold === "number" &&
    Number.isFinite(body.sep1DisableThreshold)
      ? Math.max(1, Math.min(20, Math.floor(body.sep1DisableThreshold)))
      : Math.max(
          1,
          Math.min(20, Number(process.env.ANCHOR_SEP1_404_DISABLE_THRESHOLD ?? 3))
        );

  const r = await refreshCapabilities({ limit, country, sep1DisableThreshold });
  return res.status(200).json({
    status: "ok",
    action: "refresh_capabilities",
    refreshed: r.refreshed,
    ok: r.ok,
    errors: r.errors,
    results: r.results,
  });
}

async function handleSync(req: VercelRequest, body: Record<string, unknown>, res: VercelResponse) {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({
      error:
        "Unauthorized cron request. Provide ?secret=... matching CRON_SECRET or configure Vercel cron header.",
    });
  }

  const sourceUrl =
    asString(body.sourceUrl) ||
    getQueryValue(req, "sourceUrl") ||
    process.env.STELLAR_ANCHOR_DIRECTORY_URL?.trim();
  const directoryHome =
    asString(body.directoryHome) ||
    getQueryValue(req, "directoryHome") ||
    process.env.STELLAR_ANCHOR_DIRECTORY_HOME?.trim() ||
    DEFAULT_DIRECTORY_HOME;
  const discoveryMode =
    asString(body.mode) ||
    getQueryValue(req, "mode") ||
    process.env.ANCHOR_DISCOVERY_MODE?.trim() ||
    "directory";
  const allowHorizonFallback =
    body.allowHorizon === true ||
    getQueryValue(req, "allowHorizon") === "true" ||
    String(process.env.ANCHOR_ENABLE_HORIZON_FALLBACK ?? "false").toLowerCase() ===
      "true";
  const horizonUrl = asString(body.horizonUrl) || getQueryValue(req, "horizonUrl");
  const issuerLimit = parseLimit(
    asString(body.issuerLimit) || getQueryValue(req, "issuerLimit"),
    250
  );
  const assetPages = parseLimit(
    asString(body.assetPages) || getQueryValue(req, "assetPages"),
    4
  );
  const issuerConcurrency = parseLimit(
    asString(body.issuerConcurrency) || getQueryValue(req, "issuerConcurrency"),
    20
  );
  const domainConcurrency = parseLimit(
    asString(body.domainConcurrency) || getQueryValue(req, "domainConcurrency"),
    8
  );
  const refreshLimit = parseLimit(
    asString(body.refreshLimit) || getQueryValue(req, "refreshLimit"),
    300
  );
  const sep1DisableThreshold = parseLimit(
    process.env.ANCHOR_SEP1_404_DISABLE_THRESHOLD,
    3
  );
  const allowedDomains = parseAllowedDomainsFromEnv();

  let importResult: {
    source: string;
    totalNormalized: number;
    written: number;
    skippedSourceRows: number;
  } | null = null;

  if (sourceUrl) {
    const loaded = await loadAnchorDirectory({
      downloadUrl: sourceUrl,
      active: true,
      allowedDomains,
      requireAllowedDomains: true,
      requireDirectoryProvenance: true,
      rejectHorizonStrategy: true,
    });
    const written = await upsertAnchorsCatalog(loaded.rows);
    importResult = {
      source: loaded.source,
      totalNormalized: loaded.rows.length,
      written,
      skippedSourceRows: loaded.skipped,
    };
  } else {
    const loaded =
      discoveryMode === "horizon" && allowHorizonFallback
        ? await (async () => {
            try {
              const discovered = await discoverAnchorsFromHorizon({
                horizonUrl: horizonUrl || undefined,
                issuerLimit,
                assetPages,
                issuerConcurrency,
                domainConcurrency,
              });
              return {
                source: `horizon:${
                  horizonUrl ||
                  process.env.STELLAR_HORIZON_URL ||
                  "https://horizon.stellar.org"
                }`,
                rows: discovered.rows,
                skipped: 0,
              };
            } catch {
              return await discoverFromAnchorsStellarOrg(directoryHome);
            }
          })()
        : await discoverFromAnchorsStellarOrg(directoryHome);

    const written = await upsertAnchorsCatalog(loaded.rows);
    importResult = {
      source: loaded.source,
      totalNormalized: loaded.rows.length,
      written,
      skippedSourceRows: loaded.skipped,
    };
  }

  const refreshed = await refreshCapabilities({
    limit: refreshLimit,
    sep1DisableThreshold,
  });

  return res.status(200).json({
    status: "ok",
    action: "sync",
    triggeredAt: new Date().toISOString(),
    sourceUrl: sourceUrl || null,
    directoryHome,
    discoveryMode,
    allowHorizonFallback,
    horizonUrl: horizonUrl || process.env.STELLAR_HORIZON_URL || null,
    issuerLimit,
    assetPages,
    issuerConcurrency,
    domainConcurrency,
    import: importResult,
    refresh: {
      requested: refreshLimit,
      processed: refreshed.refreshed,
      ok: refreshed.ok,
      errors: refreshed.errors,
    },
    results: refreshed.results,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = readJsonBody(req);
  const body = parsed.ok ? parsed.value : {};
  if (req.method === "POST" && !parsed.ok) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const action =
    parseAction(body.action) ||
    parseAction(getQueryValue(req, "action")) ||
    (req.method === "GET" ? "sync" : "");

  if (!action) {
    return res.status(400).json({
      error: "Invalid action. Use: import_directory | refresh_capabilities | sync",
    });
  }

  try {
    if (action === "import_directory") {
      return await handleImportDirectory(body, res);
    }
    if (action === "refresh_capabilities") {
      return await handleRefreshCapabilities(body, res);
    }
    return await handleSync(req, body, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ status: "error", action, error: message });
  }
}

