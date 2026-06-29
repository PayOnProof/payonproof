import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../../lib/http.js";
import { applyCors, handleCorsPreflight } from "../../lib/cors.js";
import {
  deleteAnchor,
  listAnchors,
  setAnchorActive,
  updateAnchorCapabilities,
  upsertAnchorsCatalog,
} from "../../lib/repositories/anchors-catalog.js";
import { resolveAnchorCapabilities } from "../../lib/stellar/capabilities.js";
import { discoverAnchorFromDomain } from "../../lib/stellar/sep1.js";
import { fetchSep24Info } from "../../lib/stellar/sep24.js";
import type { AnchorCatalogImportRow } from "../../lib/stellar/anchor-directory.js";
import type { AnchorCatalogEntry } from "../../lib/remittances/compare/types.js";
import { requireAdminSession } from "../../lib/admin-auth.js";

type AdminAction =
  | "discover_domain"
  | "upsert"
  | "set_active"
  | "delete"
  | "refresh"
  | "refresh_all";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,\s;|]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseAction(value: unknown): AdminAction | "" {
  const action = asString(value).toLowerCase();
  switch (action) {
    case "discover_domain":
    case "upsert":
    case "set_active":
    case "delete":
    case "refresh":
    case "refresh_all":
      return action;
    default:
      return "";
  }
}

function getQueryParam(req: VercelRequest, key: string): string {
  if (req.query && typeof req.query[key] === "string") {
    return (req.query[key] as string).trim();
  }
  const rawUrl = req.url ?? "";
  const query = rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?") + 1) : "";
  if (!query) return "";
  return new URLSearchParams(query).get(key)?.trim() ?? "";
}

function normalizeDomain(input: string): string {
  const trimmed = input.trim();
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

function normalizeIso2(value: string): string {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

function normalizeAssetCode(value: string): string {
  const code = value.split(":")[0]?.trim().toUpperCase() ?? "";
  return /^[A-Z0-9]{2,12}$/.test(code) ? code : "";
}

function toId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function pickName(info: unknown, fallback: string): string {
  if (info && typeof info === "object") {
    const root = info as Record<string, unknown>;
    for (const key of ["org_name", "name", "orgName"]) {
      const value = root[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return fallback;
}

function extractAssetRows(
  info: unknown,
  sectionName: "deposit" | "withdraw"
): string[] {
  if (!info || typeof info !== "object") return [];
  const root = info as Record<string, unknown>;
  const section = root[sectionName];
  if (!section || typeof section !== "object") return [];
  return [...new Set(Object.keys(section as Record<string, unknown>).map(normalizeAssetCode).filter(Boolean))];
}

function buildImportRows(input: {
  domain: string;
  name: string;
  countries: string[];
  depositAssets: string[];
  withdrawAssets: string[];
  active: boolean;
}): AnchorCatalogImportRow[] {
  const countries = input.countries
    .map(normalizeIso2)
    .filter(Boolean);
  const rows: AnchorCatalogImportRow[] = [];

  for (const country of countries) {
    for (const currency of input.depositAssets) {
      rows.push({
        id: toId(`anchor-${input.domain}-${country}-${currency}-on-ramp`),
        name: input.name,
        domain: input.domain,
        country,
        currency,
        type: "on-ramp",
        active: input.active,
      });
    }
    for (const currency of input.withdrawAssets) {
      rows.push({
        id: toId(`anchor-${input.domain}-${country}-${currency}-off-ramp`),
        name: input.name,
        domain: input.domain,
        country,
        currency,
        type: "off-ramp",
        active: input.active,
      });
    }
  }

  const deduped = new Map<string, AnchorCatalogImportRow>();
  for (const row of rows) deduped.set(row.id, row);
  return [...deduped.values()];
}

async function refreshAnchor(anchor: AnchorCatalogEntry) {
  const resolved = await resolveAnchorCapabilities({
    domain: anchor.domain,
    assetCode: anchor.currency,
  });
  const operational = Boolean(
    resolved.sep.sep10 &&
      resolved.sep.sep24 &&
      resolved.endpoints.webAuthEndpoint &&
      resolved.endpoints.transferServerSep24
  );

  await updateAnchorCapabilities({
    id: anchor.id,
    sep24: resolved.sep.sep24,
    sep6: resolved.sep.sep6,
    sep31: resolved.sep.sep31,
    sep10: resolved.sep.sep10,
    operational,
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

  return {
    id: anchor.id,
    domain: anchor.domain,
    currency: anchor.currency,
    type: anchor.type,
    operational,
    sep: resolved.sep,
    diagnostics: resolved.diagnostics,
  };
}

async function handleDiscover(body: Record<string, unknown>) {
  const domain = normalizeDomain(asString(body.domain));
  if (!domain) throw new Error("Missing field: domain");

  const sep1 = await discoverAnchorFromDomain({ domain });
  let sep24Info: unknown;
  if (sep1.transferServerSep24) {
    sep24Info = (await fetchSep24Info({
      transferServerSep24: sep1.transferServerSep24,
    })).info;
  }

  const requestedAssets = asStringArray(body.currencies).map(normalizeAssetCode).filter(Boolean);
  const depositAssets = extractAssetRows(sep24Info, "deposit");
  const withdrawAssets = extractAssetRows(sep24Info, "withdraw");
  const filteredDeposit = requestedAssets.length
    ? depositAssets.filter((asset) => requestedAssets.includes(asset))
    : depositAssets;
  const filteredWithdraw = requestedAssets.length
    ? withdrawAssets.filter((asset) => requestedAssets.includes(asset))
    : withdrawAssets;
  const countries = asStringArray(body.countries);
  const active = body.active !== false;
  const rows = buildImportRows({
    domain: sep1.domain,
    name: pickName(sep24Info, sep1.domain),
    countries,
    depositAssets: filteredDeposit,
    withdrawAssets: filteredWithdraw,
    active,
  });

  const apply = body.apply === true;
  if (apply && rows.length === 0) {
    throw new Error(
      "No real catalog rows discovered. Provide valid ISO-2 countries and at least one SEP-24 deposit/withdraw asset."
    );
  }
  const written = apply ? await upsertAnchorsCatalog(rows) : 0;
  return {
    status: "ok",
    action: "discover_domain",
    apply,
    written,
    discovered: {
      domain: sep1.domain,
      signingKey: Boolean(sep1.signingKey),
      sep10: Boolean(sep1.webAuthEndpoint),
      sep24: Boolean(sep1.transferServerSep24),
      sep6: Boolean(sep1.transferServerSep6),
      sep31: Boolean(sep1.directPaymentServer),
      webAuthEndpoint: sep1.webAuthEndpoint,
      transferServerSep24: sep1.transferServerSep24,
      directPaymentServer: sep1.directPaymentServer,
      depositAssets,
      withdrawAssets,
    },
    rows,
  };
}

async function handleUpsert(body: Record<string, unknown>) {
  const domain = normalizeDomain(asString(body.domain));
  const name = asString(body.name) || domain;
  const countries = asStringArray(body.countries);
  const currencies = asStringArray(body.currencies).map(normalizeAssetCode).filter(Boolean);
  const types = asStringArray(body.types);
  const active = body.active !== false;
  if (!domain || !name || countries.length === 0 || currencies.length === 0) {
    throw new Error("Missing fields: domain, name, countries, currencies");
  }

  const rows = buildImportRows({
    domain,
    name,
    countries,
    depositAssets: types.includes("off-ramp") ? [] : currencies,
    withdrawAssets: types.includes("on-ramp") ? [] : currencies,
    active,
  });
  const written = await upsertAnchorsCatalog(rows);
  return { status: "ok", action: "upsert", written, rows };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsPreflight(req, res, ["GET", "POST", "OPTIONS"])) return;
  applyCors(req, res, ["GET", "POST", "OPTIONS"]);

  try {
    requireAdminSession(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized admin request" });
  }

  if (req.method === "GET") {
    const anchors = await listAnchors({
      includeInactive: true,
      includeAllNetworks: true,
    });
    const country = getQueryParam(req, "country").toUpperCase();
    const type = getQueryParam(req, "type");
    const domain = getQueryParam(req, "domain").toLowerCase();
    const network = getQueryParam(req, "network").toLowerCase();
    const operational = getQueryParam(req, "operational");
    const active = getQueryParam(req, "active");
    const filtered = anchors.filter((anchor) => {
      if (country && anchor.country !== country) return false;
      if (domain && !anchor.domain.includes(domain)) return false;
      if ((network === "mainnet" || network === "testnet") && anchor.network !== network) {
        return false;
      }
      if ((type === "on-ramp" || type === "off-ramp") && anchor.type !== type) return false;
      if (operational === "true" && !anchor.capabilities.operational) return false;
      if (operational === "false" && anchor.capabilities.operational) return false;
      if (active === "true" && !anchor.active) return false;
      if (active === "false" && anchor.active) return false;
      return true;
    });
    return res.status(200).json({ anchors: filtered });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = readJsonBody(req);
  if (!parsed.ok) return res.status(400).json({ error: "Invalid request body" });

  const body = parsed.value;
  const action = parseAction(body.action);
  if (!action) {
    return res.status(400).json({
      error:
        "Invalid action. Use discover_domain | upsert | set_active | delete | refresh | refresh_all",
    });
  }

  try {
    if (action === "discover_domain") {
      return res.status(200).json(await handleDiscover(body));
    }
    if (action === "upsert") {
      return res.status(200).json(await handleUpsert(body));
    }
    if (action === "set_active") {
      const id = asString(body.id);
      if (!id) return res.status(400).json({ error: "Missing field: id" });
      await setAnchorActive({ id, active: body.active !== false });
      return res.status(200).json({ status: "ok", action, id, active: body.active !== false });
    }
    if (action === "delete") {
      const id = asString(body.id);
      if (!id) return res.status(400).json({ error: "Missing field: id" });
      await deleteAnchor(id);
      return res.status(200).json({ status: "ok", action, id });
    }

    const anchors = await listAnchors({
      includeInactive: true,
      includeAllNetworks: true,
    });
    if (action === "refresh") {
      const id = asString(body.id);
      const anchor = anchors.find((item) => item.id === id);
      if (!anchor) return res.status(404).json({ error: "Anchor not found" });
      return res.status(200).json({ status: "ok", action, result: await refreshAnchor(anchor) });
    }

    const limit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.max(1, Math.min(200, Math.floor(body.limit)))
        : 50;
    const results = [];
    for (const anchor of anchors.slice(0, limit)) {
      try {
        results.push({ status: "ok", ...(await refreshAnchor(anchor)) });
      } catch (error) {
        results.push({
          status: "error",
          id: anchor.id,
          domain: anchor.domain,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return res.status(200).json({ status: "ok", action, processed: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ status: "error", action, error: message });
  }
}
