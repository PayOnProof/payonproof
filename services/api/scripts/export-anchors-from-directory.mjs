#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_HOME_URL = "https://anchors.stellar.org/";

function parseArgs(argv) {
  const options = {
    homeUrl: DEFAULT_HOME_URL,
    outFile: "services/api/data/anchors-export.json",
    minRows: 10,
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
    if (arg === "--min-rows" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.minRows = Math.floor(parsed);
      }
      i += 1;
      continue;
    }
    if (arg === "--raw-out" && argv[i + 1]) {
      options.rawOutFile = argv[i + 1];
      i += 1;
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidates = [];

  const plain = await tryUrlCandidates(options.homeUrl);
  if (plain) candidates.push(plain);

  const pw = await tryPlaywright(options.homeUrl);
  if (pw) candidates.push(pw);

  if (!candidates.length) {
    throw new Error("No machine-readable payload discovered from anchors directory");
  }

  const best = candidates.sort((a, b) => b.rows.length - a.rows.length)[0];
  const normalized = [];
  for (const row of best.rows) {
    normalized.push(...normalizeRecord(row));
  }

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

  const dedup = new Map();
  for (const row of normalized) {
    const key = `${row.domain}|${row.type}|${row.countries.join(",")}|${row.currencies.join(",")}`;
    dedup.set(key, row);
  }
  const anchors = [...dedup.values()];

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
