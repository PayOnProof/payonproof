#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_HOME_URL = "https://anchors.stellar.org/";
const DEFAULT_HORIZON_URL = "https://horizon.stellar.org";
const DEFAULT_RESOURCES_URL = "https://resources.stellar.org/anchor-directory";

function parseArgs(argv) {
  const options = {
    homeUrl: DEFAULT_HOME_URL,
    resourcesUrl: DEFAULT_RESOURCES_URL,
    horizonUrl: DEFAULT_HORIZON_URL,
    outFile: "services/api/data/anchors-export.json",
    minRows: 10,
    issuerLimit: 300,
    assetPages: 4,
    domainConcurrency: 10,
    strictDirectory: false,
    debug: false,
    rawOutFile: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--home-url" && argv[i + 1]) {
      options.homeUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--out" && argv[i + 1]) {
      options.outFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--resources-url" && argv[i + 1]) {
      options.resourcesUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--horizon-url" && argv[i + 1]) {
      options.horizonUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--min-rows" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.minRows = Math.floor(parsed);
      }
      i += 1;
      continue;
    }
    if (arg === "--issuer-limit" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.issuerLimit = Math.floor(parsed);
      }
      i += 1;
      continue;
    }
    if (arg === "--asset-pages" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.assetPages = Math.floor(parsed);
      }
      i += 1;
      continue;
    }
    if (arg === "--domain-concurrency" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.domainConcurrency = Math.floor(parsed);
      }
      i += 1;
      continue;
    }
    if (arg === "--raw-out" && argv[i + 1]) {
      options.rawOutFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--strict-directory") {
      options.strictDirectory = true;
      continue;
    }
    if (arg === "--debug") {
      options.debug = true;
    }
  }

  return options;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function looksLikeAnchorRecord(value) {
  if (!isRecord(value)) return false;
  const row = value;
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
    Boolean(row.countryCode) ||
    Boolean(row.currency) ||
    Boolean(row.currencies) ||
    Boolean(row.currency_code) ||
    Boolean(row.currency_codes) ||
    Boolean(row.asset_code) ||
    Boolean(row.asset_codes) ||
    Boolean(row.assets) ||
    Boolean(row.assets_supported);

  return hasDomain && hasMeta;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function toAbsolute(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function extractLinksFromHtml(baseUrl, html) {
  const links = [];
  const hrefRegex = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const absolute = toAbsolute(baseUrl, match[1]);
    if (absolute) links.push(absolute);
  }
  return unique(links);
}

function pickString(obj, keys) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
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

function normalizeCountry(code) {
  const c = String(code || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : "";
}

function normalizeCurrency(code) {
  const c = String(code || "").trim().toUpperCase();
  return /^[A-Z0-9]{2,12}$/.test(c) ? c : "";
}

function normalizeDomain(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  }
}

function inferTypes(row) {
  const t = pickString(row, ["type", "ramp_type", "direction", "flow"]).toLowerCase();
  if (t.includes("both") || t.includes("two-way")) return ["on-ramp", "off-ramp"];
  if (t.includes("on") || t.includes("deposit")) return ["on-ramp"];
  if (t.includes("off") || t.includes("withdraw")) return ["off-ramp"];
  const supportsDeposit = row.supports_deposit === true;
  const supportsWithdraw = row.supports_withdraw === true;
  if (supportsDeposit && supportsWithdraw) return ["on-ramp", "off-ramp"];
  if (supportsDeposit) return ["on-ramp"];
  if (supportsWithdraw) return ["off-ramp"];
  return ["on-ramp", "off-ramp"];
}

function normalizeRecord(raw) {
  if (!isRecord(raw)) return [];

  const name = pickString(raw, ["name", "anchor_name", "organization", "org"]) || "Unknown";
  const domain = normalizeDomain(
    pickString(raw, ["domain", "home_domain", "homeDomain", "website", "url"])
  );
  if (!domain) return [];

  const countries = unique(
    [
      ...toArray(raw.country),
      ...toArray(raw.countries),
      ...toArray(raw.country_code),
      ...toArray(raw.country_codes),
      ...toArray(raw.countryCode),
    ]
      .map(normalizeCountry)
      .filter(Boolean)
  );
  const currencies = unique(
    [
      ...toArray(raw.currency),
      ...toArray(raw.currencies),
      ...toArray(raw.currency_code),
      ...toArray(raw.currency_codes),
      ...toArray(raw.asset_code),
      ...toArray(raw.asset_codes),
    ]
      .map(normalizeCurrency)
      .filter(Boolean)
  );
  if (!countries.length || !currencies.length) return [];

  const types = inferTypes(raw);
  return types.map((type) => ({
    name,
    domain,
    countries,
    currencies,
    type,
    active: true,
  }));
}

function collectRecords(input, out, seen = new Set()) {
  if (!input) return;
  if (seen.has(input)) return;
  if (typeof input !== "object") return;
  seen.add(input);

  if (Array.isArray(input)) {
    for (const item of input) {
      if (looksLikeAnchorRecord(item)) out.push(item);
      collectRecords(item, out, seen);
    }
    return;
  }
  for (const value of Object.values(input)) {
    collectRecords(value, out, seen);
  }
}

async function fetchText(url, accept = "application/json,text/plain,text/html") {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: accept },
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  return await res.text();
}

async function tryUrlCandidates(homeUrl) {
  const html = await fetchText(homeUrl);
  const links = extractLinksFromHtml(homeUrl, html);
  const origin = new URL(homeUrl).origin;
  const guessed = [
    `${origin}/anchors.json`,
    `${origin}/api/anchors`,
    `${origin}/api/v1/anchors`,
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
      const raw = await fetchText(url);
      const parsed = JSON.parse(raw);
      const rows = [];
      collectRecords(parsed, rows);
      if (rows.length) {
        return { rows, source: url, strategy: "http-candidate", rawPayload: parsed };
      }
    } catch {
      // keep trying
    }
  }

  return null;
}

function keyMap(record) {
  const map = new Map();
  for (const [key, value] of Object.entries(record || {})) {
    const norm = String(key || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    map.set(norm, value);
  }
  return map;
}

function pickMappedString(map, keys) {
  for (const key of keys) {
    const value = map.get(key);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickMappedArray(map, keys) {
  for (const key of keys) {
    const value = map.get(key);
    if (Array.isArray(value)) {
      const arr = value.map((item) => String(item || "").trim()).filter(Boolean);
      if (arr.length) return arr;
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(/[;,|]/g)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function parseBool(value) {
  if (typeof value === "boolean") return value;
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (!v) return false;
  return ["1", "true", "yes", "y", "si", "on", "supported"].includes(v);
}

function coerceSpreadsheetRow(raw) {
  if (!isRecord(raw)) return null;
  const map = keyMap(raw);
  const domain = pickMappedString(map, [
    "domain",
    "homedomain",
    "homeurl",
    "website",
    "url",
    "homepage",
    "anchorurl",
  ]);
  const country = pickMappedArray(map, ["countrycode", "countrycodes", "country", "countries"]);
  const currency = pickMappedArray(map, [
    "currency",
    "currencies",
    "currencycode",
    "currencycodes",
    "asset",
    "assets",
    "assetcode",
    "assetcodes",
  ]);
  const name = pickMappedString(map, ["anchorname", "name", "organization", "orgname", "org"]);
  const onRamp =
    parseBool(map.get("onramp")) ||
    parseBool(map.get("deposit")) ||
    parseBool(map.get("supportsdeposit"));
  const offRamp =
    parseBool(map.get("offramp")) ||
    parseBool(map.get("withdraw")) ||
    parseBool(map.get("supportswithdraw"));
  let type = "both";
  if (onRamp && !offRamp) type = "on-ramp";
  else if (!onRamp && offRamp) type = "off-ramp";
  else if (!onRamp && !offRamp) {
    type = pickMappedString(map, ["type", "ramptype", "flow", "direction"]) || "both";
  }

  return {
    name: name || "Unknown",
    domain,
    countries: country,
    currencies: currency,
    type,
    supports_deposit: onRamp,
    supports_withdraw: offRamp,
  };
}

function parseCsvRows(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  for (const line of lines.slice(1)) {
    const values = line.split(",").map((v) => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

async function tryResourcesDirectory(options) {
  const candidates = [];
  for (const pageUrl of unique([options.resourcesUrl, options.homeUrl])) {
    try {
      const html = await fetchText(pageUrl, "text/html");
      const links = extractLinksFromHtml(pageUrl, html);
      for (const link of links) {
        if (!/anchor-directory/i.test(link)) continue;
        if (!/\.(xlsx|csv|json)(\?|$)/i.test(link)) continue;
        candidates.push(link);
      }
    } catch {
      // ignore
    }
  }

  const files = unique(candidates);
  for (const url of files) {
    try {
      if (/\.json(\?|$)/i.test(url)) {
        const parsed = JSON.parse(await fetchText(url));
        const rows = [];
        collectRecords(parsed, rows);
        if (rows.length) return { source: url, strategy: "resources-json", rows, rawPayload: parsed };
      }
      if (/\.csv(\?|$)/i.test(url)) {
        const csv = await fetchText(url, "text/csv,text/plain");
        const sourceRows = parseCsvRows(csv);
        const rows = sourceRows.map(coerceSpreadsheetRow).filter(Boolean);
        if (rows.length) {
          return {
            source: url,
            strategy: "resources-csv",
            rows,
            rawPayload: { csvRows: sourceRows.length },
          };
        }
      }
      if (/\.xlsx(\?|$)/i.test(url)) {
        let xlsx;
        try {
          xlsx = await import("xlsx");
        } catch {
          continue;
        }
        const res = await fetch(url, { headers: { Accept: "application/octet-stream" } });
        if (!res.ok) continue;
        const arr = Buffer.from(await res.arrayBuffer());
        const workbook = xlsx.read(arr, { type: "buffer" });
        const rows = [];
        for (const sheetName of workbook.SheetNames) {
          const sheetRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
            defval: "",
          });
          for (const row of sheetRows) rows.push(coerceSpreadsheetRow(row));
        }
        const validRows = rows.filter(Boolean);
        if (validRows.length) {
          return {
            source: url,
            strategy: "resources-xlsx",
            rows: validRows,
            rawPayload: { workbookSheets: workbook.SheetNames.length, rowCount: validRows.length },
          };
        }
      }
    } catch {
      // ignore and continue
    }
  }
  return null;
}

async function parseDownloadedDirectoryFile(url, bodyBuffer) {
  if (!bodyBuffer || !bodyBuffer.length) return null;

  if (/\.json(\?|$)/i.test(url)) {
    const parsed = JSON.parse(bodyBuffer.toString("utf-8"));
    const rows = [];
    collectRecords(parsed, rows);
    if (rows.length) {
      return {
        source: url,
        strategy: "playwright-download-json",
        rows,
        rawPayload: { rowCount: rows.length },
      };
    }
    return null;
  }

  if (/\.csv(\?|$)/i.test(url)) {
    const csv = bodyBuffer.toString("utf-8");
    const sourceRows = parseCsvRows(csv);
    const rows = sourceRows.map(coerceSpreadsheetRow).filter(Boolean);
    if (rows.length) {
      return {
        source: url,
        strategy: "playwright-download-csv",
        rows,
        rawPayload: { csvRows: sourceRows.length },
      };
    }
    return null;
  }

  if (/\.xlsx(\?|$)/i.test(url)) {
    let xlsx;
    try {
      xlsx = await import("xlsx");
    } catch {
      return null;
    }
    const workbook = xlsx.read(bodyBuffer, { type: "buffer" });
    const rows = [];
    for (const sheetName of workbook.SheetNames) {
      const sheetRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: "",
      });
      for (const row of sheetRows) rows.push(coerceSpreadsheetRow(row));
    }
    const validRows = rows.filter(Boolean);
    if (validRows.length) {
      return {
        source: url,
        strategy: "playwright-download-xlsx",
        rows: validRows,
        rawPayload: { workbookSheets: workbook.SheetNames.length, rowCount: validRows.length },
      };
    }
  }

  return null;
}

async function tryPlaywrightDownloadFromDirectory(homeUrl) {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    return null;
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  const captured = [];
  page.on("response", async (response) => {
    try {
      const url = response.url();
      const ct = String(response.headers()["content-type"] || "").toLowerCase();
      const cd = String(response.headers()["content-disposition"] || "").toLowerCase();
      const looksLikeFile =
        /\.(xlsx|csv|json)(\?|$)/i.test(url) ||
        ct.includes("spreadsheet") ||
        ct.includes("csv") ||
        ct.includes("json") ||
        cd.includes(".xlsx") ||
        cd.includes(".csv") ||
        cd.includes(".json");
      if (!looksLikeFile) return;
      const buffer = Buffer.from(await response.body());
      captured.push({ url, buffer });
    } catch {
      // ignore
    }
  });

  try {
    await page.goto(homeUrl, { waitUntil: "networkidle", timeout: 60000 });

    const clicked = await page.evaluate(() => {
      const candidates = [...document.querySelectorAll("a,button")];
      for (const el of candidates) {
        const text = (el.textContent || "").trim();
        const href = (el.getAttribute("href") || "").trim();
        const hasDownloadWord = /download|export/i.test(text) || /download|export/i.test(href);
        if (!hasDownloadWord) continue;
        const disabled =
          el.hasAttribute("disabled") ||
          String(el.getAttribute("aria-disabled") || "").toLowerCase() === "true";
        if (disabled) continue;
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return true;
      }
      return false;
    });

    if (!clicked) return null;
    await page.waitForTimeout(5000);

    for (const file of captured) {
      const parsed = await parseDownloadedDirectoryFile(file.url, file.buffer);
      if (parsed) return parsed;
    }
    return null;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function tryPlaywright(homeUrl) {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    return null;
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const foundJson = [];

  page.on("response", async (response) => {
    try {
      const url = response.url();
      const ct = (response.headers()["content-type"] || "").toLowerCase();
      const looksRelevantUrl = /anchor|directory|stellar|sep/i.test(url);
      if (!ct.includes("json") && !looksRelevantUrl) return;
      if (/mapbox|tile|geojson|country-boundaries/i.test(url)) return;
      const text = await response.text();
      const parsed = JSON.parse(text);
      foundJson.push({ url, parsed });
    } catch {
      // ignore
    }
  });

  try {
    await page.goto(homeUrl, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(4000);
    const nextData = await page.evaluate(() => (window).__NEXT_DATA__ ?? null);
    if (nextData) {
      foundJson.push({ url: `${homeUrl}#__NEXT_DATA__`, parsed: nextData });
    }
  } finally {
    await browser.close();
  }

  for (const candidate of foundJson) {
    const rows = [];
    collectRecords(candidate.parsed, rows);
    if (rows.length) {
      return {
        rows,
        source: candidate.url,
        strategy: "playwright-network",
        rawPayload: candidate.parsed,
      };
    }
  }

  return null;
}

function isLikelyDomainHost(hostname) {
  if (typeof hostname !== "string") return false;
  const host = hostname.trim().toLowerCase();
  if (!host || !host.includes(".")) return false;
  if (!/^[a-z0-9.-]+$/.test(host)) return false;
  if (host.startsWith(".") || host.endsWith(".")) return false;
  return true;
}

function filterDirectoryDomains(domains) {
  const blocked = new Set([
    "anchors.stellar.org",
    "stellar.org",
    "www.stellar.org",
    "developers.stellar.org",
    "docs.stellar.org",
    "github.com",
    "www.github.com",
    "twitter.com",
    "x.com",
    "www.x.com",
    "mapbox.com",
    "api.mapbox.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "sentry.io",
    "google.com",
    "www.google.com",
    "youtube.com",
    "www.youtube.com",
  ]);

  return unique(
    domains
      .map((value) => normalizeDomain(value))
      .filter((host) => isLikelyDomainHost(host) && !blocked.has(host))
  );
}

async function tryDirectoryDomainsPlaywright(homeUrl) {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    return null;
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(homeUrl, { waitUntil: "networkidle", timeout: 60000 });

    let stableRounds = 0;
    let lastHeight = 0;
    for (let i = 0; i < 30; i += 1) {
      const clicked = await page.evaluate(() => {
        const targets = [
          /load more/i,
          /show more/i,
          /more anchors/i,
          /see more/i,
          /next/i,
        ];
        const elements = [
          ...document.querySelectorAll("button"),
          ...document.querySelectorAll("a[role='button']"),
        ];
        for (const el of elements) {
          const text = (el.textContent || "").trim();
          if (!text) continue;
          const matches = targets.some((re) => re.test(text));
          if (!matches) continue;
          const disabled =
            el.hasAttribute("disabled") ||
            String(el.getAttribute("aria-disabled") || "").toLowerCase() === "true";
          if (disabled) continue;
          el.click();
          return true;
        }
        return false;
      });

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(clicked ? 1800 : 1200);

      const height = await page.evaluate(() => document.body.scrollHeight);
      if (height <= lastHeight + 20 && !clicked) stableRounds += 1;
      else stableRounds = 0;
      lastHeight = height;
      if (stableRounds >= 5) break;
    }

    const payload = await page.evaluate(() => {
      const parts = [];
      for (const a of document.querySelectorAll("a[href]")) {
        parts.push(a.getAttribute("href") || "");
        parts.push(a.href || "");
        parts.push(a.textContent || "");
      }
      parts.push(document.body?.innerText || "");
      return parts.join("\n");
    });

    const matches = [];
    const regex =
      /(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]{0,61}(?:\.[a-z0-9][a-z0-9-]{0,61}){1,})/gi;
    let match;
    while ((match = regex.exec(payload)) !== null) {
      matches.push(match[1]);
    }

    const domains = filterDirectoryDomains(matches);
    if (!domains.length) return null;
    return {
      source: `${homeUrl}#playwright-domains`,
      strategy: "playwright-directory-domains",
      domains,
      rawPayload: { domainCount: domains.length, sample: domains.slice(0, 20) },
    };
  } finally {
    await browser.close();
  }
}

function parseTomlFlat(text) {
  const result = {};
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("[")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    result[key] = value;
  }
  return result;
}

async function fetchJson(url) {
  const raw = await fetchText(url, "application/json");
  return JSON.parse(raw);
}

async function mapWithConcurrency(items, concurrency, worker) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const limit = Math.max(1, Math.min(Number(concurrency) || 1, list.length));
  const results = new Array(list.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= list.length) return;
      results[current] = await worker(list[current], current);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => run()));
  return results;
}

function normalizeSepCountries(value) {
  if (Array.isArray(value)) {
    return unique(value.map(normalizeCountry).filter(Boolean));
  }
  return [];
}

function extractSepAssetRows(info) {
  if (!isRecord(info)) return [];
  const rows = [];
  const root = info;
  const deposit = isRecord(root.deposit) ? root.deposit : {};
  const withdraw = isRecord(root.withdraw) ? root.withdraw : {};

  for (const [key, cfg] of Object.entries(deposit)) {
    const currency = normalizeCurrency(String(key).split(":")[0] || "");
    if (!currency) continue;
    const countries = isRecord(cfg)
      ? unique([
          ...normalizeSepCountries(cfg.countries),
          normalizeCountry(cfg.country_code),
          normalizeCountry(cfg.country),
        ]).filter(Boolean)
      : [];
    rows.push({ type: "on-ramp", currency, countries });
  }
  for (const [key, cfg] of Object.entries(withdraw)) {
    const currency = normalizeCurrency(String(key).split(":")[0] || "");
    if (!currency) continue;
    const countries = isRecord(cfg)
      ? unique([
          ...normalizeSepCountries(cfg.countries),
          normalizeCountry(cfg.country_code),
          normalizeCountry(cfg.country),
        ]).filter(Boolean)
      : [];
    rows.push({ type: "off-ramp", currency, countries });
  }
  return rows;
}

async function tryHorizonFallback(options) {
  const base = options.horizonUrl.replace(/\/+$/, "");
  let nextUrl = `${base}/assets?limit=200&order=desc`;
  const issuers = new Set();

  for (let page = 0; page < Math.max(1, options.assetPages); page += 1) {
    const payload = await fetchJson(nextUrl);
    const records = payload?._embedded?.records ?? [];
    if (!Array.isArray(records) || records.length === 0) break;
    for (const record of records) {
      if (record?.asset_type === "native") continue;
      if (typeof record?.asset_issuer === "string") issuers.add(record.asset_issuer);
    }
    const href = payload?._links?.next?.href;
    if (!href || typeof href !== "string") break;
    nextUrl = href;
  }

  const issuerList = [...issuers].slice(0, Math.max(1, options.issuerLimit));
  const domains = new Set();
  for (const issuer of issuerList) {
    try {
      const account = await fetchJson(`${base}/accounts/${issuer}`);
      const homeDomain = String(account?.home_domain || "").trim().toLowerCase();
      if (homeDomain) domains.add(homeDomain);
    } catch {
      // ignore
    }
  }

  const anchors = [];
  const diagnostics = {
    domainsTotal: domains.size,
    skippedNoSep: 0,
    skippedNoSigningKey: 0,
    skippedNoWebAuth: 0,
    skippedNoAssets: 0,
  };
  for (const domain of domains) {
    try {
      const tomlRaw = await fetchText(
        `https://${domain}/.well-known/stellar.toml`,
        "text/plain, text/x-toml, application/toml"
      );
      const toml = parseTomlFlat(tomlRaw);
      const name = (toml.ORG_NAME || toml.ORG || domain || "").trim() || domain;
      const signingKey = String(toml.SIGNING_KEY || "").trim();
      const webAuthEndpoint = String(toml.WEB_AUTH_ENDPOINT || "").trim();
      const sep24 = String(toml.TRANSFER_SERVER_SEP0024 || "").trim().replace(/\/+$/, "");
      const sep6 = String(toml.TRANSFER_SERVER || "").trim().replace(/\/+$/, "");
      const sep31 = String(toml.DIRECT_PAYMENT_SERVER || "").trim().replace(/\/+$/, "");
      const inferredCountry = normalizeCountry(domain.split(".").pop()) || "ZZ";
      const rows = [];

      // Trust baseline for exported anchors.
      if (!signingKey) {
        diagnostics.skippedNoSigningKey += 1;
        continue;
      }
      if (!webAuthEndpoint) {
        diagnostics.skippedNoWebAuth += 1;
        continue;
      }
      if (!sep24 && !sep31) {
        diagnostics.skippedNoSep += 1;
        continue;
      }

      if (sep24) {
        try {
          const info = await fetchJson(`${sep24}/info`);
          rows.push(...extractSepAssetRows(info));
        } catch {
          // ignore
        }
      }
      if (sep6) {
        try {
          const info = await fetchJson(`${sep6}/info`);
          rows.push(...extractSepAssetRows(info));
        } catch {
          // ignore
        }
      }

      if (!rows.length) {
        diagnostics.skippedNoAssets += 1;
        continue;
      }

      for (const row of rows) {
        const countries = row.countries.length ? row.countries : [inferredCountry];
        anchors.push({
          name,
          domain,
          countries,
          currencies: [row.currency],
          type: row.type,
          active: true,
        });
      }
    } catch {
      // ignore
    }
  }

  return {
    source: `horizon:${options.horizonUrl}`,
    strategy: "horizon-fallback",
    anchors,
    diagnostics,
  };
}

async function buildAnchorsFromDomains(domains, options) {
  const domainList = filterDirectoryDomains(domains);
  const diagnostics = {
    domainsTotal: domainList.length,
    skippedNoSep: 0,
    skippedNoSigningKey: 0,
    skippedNoWebAuth: 0,
    skippedNoAssets: 0,
    failedToml: 0,
  };

  const batches = await mapWithConcurrency(
    domainList,
    Math.max(1, options.domainConcurrency || 10),
    async (domain) => {
      try {
        const tomlRaw = await fetchText(
          `https://${domain}/.well-known/stellar.toml`,
          "text/plain, text/x-toml, application/toml"
        );
        const toml = parseTomlFlat(tomlRaw);
        const name = (toml.ORG_NAME || toml.ORG || domain || "").trim() || domain;
        const signingKey = String(toml.SIGNING_KEY || "").trim();
        const webAuthEndpoint = String(toml.WEB_AUTH_ENDPOINT || "").trim();
        const sep24 = String(toml.TRANSFER_SERVER_SEP0024 || "").trim().replace(/\/+$/, "");
        const sep6 = String(toml.TRANSFER_SERVER || "").trim().replace(/\/+$/, "");
        const sep31 = String(toml.DIRECT_PAYMENT_SERVER || "").trim().replace(/\/+$/, "");
        const inferredCountry = normalizeCountry(domain.split(".").pop()) || "ZZ";
        const rows = [];

        if (!signingKey) {
          diagnostics.skippedNoSigningKey += 1;
          return [];
        }
        if (!webAuthEndpoint) {
          diagnostics.skippedNoWebAuth += 1;
          return [];
        }
        if (!sep24 && !sep31) {
          diagnostics.skippedNoSep += 1;
          return [];
        }

        if (sep24) {
          try {
            const info = await fetchJson(`${sep24}/info`);
            rows.push(...extractSepAssetRows(info));
          } catch {
            // ignore
          }
        }
        if (sep6) {
          try {
            const info = await fetchJson(`${sep6}/info`);
            rows.push(...extractSepAssetRows(info));
          } catch {
            // ignore
          }
        }

        if (!rows.length) {
          diagnostics.skippedNoAssets += 1;
          return [];
        }

        return rows.map((row) => ({
          name,
          domain,
          countries: row.countries.length ? row.countries : [inferredCountry],
          currencies: [row.currency],
          type: row.type,
          active: true,
        }));
      } catch {
        diagnostics.failedToml += 1;
        return [];
      }
    }
  );

  return {
    source: `${options.homeUrl}#verified-domains`,
    strategy: "directory-domain-sep",
    anchors: batches.flat(),
    diagnostics,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidates = [];

  const resources = await tryResourcesDirectory(options);
  if (resources) candidates.push(resources);

  const downloaded = await tryPlaywrightDownloadFromDirectory(options.homeUrl);
  if (downloaded) candidates.push(downloaded);

  const plain = await tryUrlCandidates(options.homeUrl);
  if (plain) candidates.push(plain);

  const pw = await tryPlaywright(options.homeUrl);
  if (pw) candidates.push(pw);

  let best;
  let anchors = [];

  if (candidates.length) {
    best = candidates.sort((a, b) => b.rows.length - a.rows.length)[0];
    const normalized = [];
    for (const row of best.rows) {
      normalized.push(...normalizeRecord(row));
    }
    const dedup = new Map();
    for (const row of normalized) {
      const key = `${row.domain}|${row.type}|${row.countries.join(",")}|${row.currencies.join(",")}`;
      dedup.set(key, row);
    }
    anchors = [...dedup.values()];

    if (options.debug) {
      console.log(
        JSON.stringify(
          {
            source: best.source,
            strategy: best.strategy,
            rawRowsFound: best.rows.length,
            normalizedRowsFound: normalized.length,
            rawSample: best.rows.slice(0, 5),
          },
          null,
          2
        )
      );
    }

    if (options.rawOutFile) {
      const rawOutPath = path.resolve(options.rawOutFile);
      await fs.mkdir(path.dirname(rawOutPath), { recursive: true });
      await fs.writeFile(
        rawOutPath,
        `${JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            source: best.source,
            strategy: best.strategy,
            rawPayload: best.rawPayload ?? null,
            rawRows: best.rows,
          },
          null,
          2
        )}\n`,
        "utf-8"
      );
      if (options.debug) {
        console.log(`Wrote raw payload debug file -> ${rawOutPath}`);
      }
    }
  }

  if (anchors.length < options.minRows) {
    const domainDiscovery = await tryDirectoryDomainsPlaywright(options.homeUrl);
    if (domainDiscovery?.domains?.length) {
      const fromDomains = await buildAnchorsFromDomains(domainDiscovery.domains, options);
      const dedup = new Map();
      for (const row of fromDomains.anchors) {
        const key = `${row.domain}|${row.type}|${row.countries.join(",")}|${row.currencies.join(",")}`;
        dedup.set(key, row);
      }
      anchors = [...dedup.values()];
      best = {
        source: fromDomains.source,
        strategy: fromDomains.strategy,
        rows: fromDomains.anchors,
        rawPayload: domainDiscovery.rawPayload ?? null,
        diagnostics: fromDomains.diagnostics,
      };
    }
  }

  if (anchors.length < options.minRows) {
    if (options.strictDirectory) {
      throw new Error(
        `Discovered only ${anchors.length} normalized anchors from anchors.stellar.org (<${options.minRows}).`
      );
    }
    const fallback = await tryHorizonFallback(options);
    const dedup = new Map();
    for (const row of fallback.anchors) {
      const key = `${row.domain}|${row.type}|${row.countries.join(",")}|${row.currencies.join(",")}`;
      dedup.set(key, row);
    }
    anchors = [...dedup.values()];
    best = {
      source: fallback.source,
      strategy: fallback.strategy,
      rows: fallback.anchors,
      rawPayload: null,
      diagnostics: fallback.diagnostics,
    };
  }

  if (anchors.length < options.minRows) {
    throw new Error(
      `Discovered only ${anchors.length} normalized anchors (<${options.minRows}). Aborting export.`
    );
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: best.source,
    strategy: best.strategy,
    homeUrl: options.homeUrl,
    diagnostics: best.diagnostics ?? undefined,
    anchors,
  };

  const outPath = path.resolve(options.outFile);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");
  console.log(
    `Exported ${anchors.length} normalized anchors from ${best.source} -> ${outPath}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
