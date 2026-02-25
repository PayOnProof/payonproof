#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 10000;

function parseArgs(argv) {
  const options = {
    file: "",
    apiBaseUrl: "http://localhost:3001",
    dryRun: true,
    refresh: true,
    refreshLimit: 300,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file" && argv[i + 1]) {
      options.file = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--api" && argv[i + 1]) {
      options.apiBaseUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--apply") {
      options.dryRun = false;
      continue;
    }
    if (arg === "--no-refresh") {
      options.refresh = false;
      continue;
    }
    if (arg === "--refresh-limit" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.refreshLimit = Math.floor(parsed);
      }
      i += 1;
      continue;
    }
  }

  return options;
}

function normalizeDomain(input) {
  return String(input ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
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

async function fetchTextWithTimeout(url, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: accept },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`${url} -> ${res.status} ${res.statusText}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithTimeout(url) {
  const raw = await fetchTextWithTimeout(url, "application/json");
  return JSON.parse(raw);
}

function normalizeCountries(value) {
  const arr = Array.isArray(value) ? value : [];
  return [...new Set(arr.map((v) => String(v).trim().toUpperCase()).filter((v) => /^[A-Z]{2}$/.test(v)))];
}

function normalizeCurrencies(value) {
  const arr = Array.isArray(value) ? value : [];
  return [...new Set(arr.map((v) => String(v).trim().toUpperCase()).filter((v) => /^[A-Z0-9]{2,12}$/.test(v)))];
}

function normalizeTypes(value) {
  const arr = Array.isArray(value) ? value : [];
  const normalized = arr
    .map((v) => String(v).trim().toLowerCase())
    .filter((v) => v === "on-ramp" || v === "off-ramp");
  return [...new Set(normalized)];
}

function extractAssetsMap(info) {
  const on = new Set();
  const off = new Set();
  if (!info || typeof info !== "object") {
    return { on, off };
  }

  const root = info;
  const deposit = root.deposit && typeof root.deposit === "object" ? root.deposit : {};
  const withdraw = root.withdraw && typeof root.withdraw === "object" ? root.withdraw : {};

  for (const key of Object.keys(deposit)) {
    const asset = String(key).split(":")[0]?.trim().toUpperCase();
    if (asset) on.add(asset);
  }
  for (const key of Object.keys(withdraw)) {
    const asset = String(key).split(":")[0]?.trim().toUpperCase();
    if (asset) off.add(asset);
  }

  return { on, off };
}

async function discoverSeed(seed) {
  const domain = normalizeDomain(seed.domain);
  if (!domain) {
    throw new Error("seed.domain is required");
  }

  const countries = normalizeCountries(seed.countries);
  if (!countries.length) {
    throw new Error(`seed.countries is required for ${domain} (ISO-2 list)`);
  }

  const configuredCurrencies = normalizeCurrencies(seed.currencies);
  const configuredTypes = normalizeTypes(seed.types);
  const active = seed.active !== false;
  const displayName = String(seed.name ?? "").trim() || domain;

  const tomlUrl = `https://${domain}/.well-known/stellar.toml`;
  const tomlRaw = await fetchTextWithTimeout(
    tomlUrl,
    "text/plain, text/x-toml, application/toml"
  );
  const toml = parseTomlFlat(tomlRaw);

  const sep24 = String(toml.TRANSFER_SERVER_SEP0024 ?? "").trim().replace(/\/+$/, "");
  const sep6 = String(toml.TRANSFER_SERVER ?? "").trim().replace(/\/+$/, "");

  const discoveredOn = new Set();
  const discoveredOff = new Set();

  if (sep24) {
    try {
      const sep24Info = await fetchJsonWithTimeout(`${sep24}/info`);
      const { on, off } = extractAssetsMap(sep24Info);
      on.forEach((a) => discoveredOn.add(a));
      off.forEach((a) => discoveredOff.add(a));
    } catch {
      // best effort
    }
  }

  if (sep6) {
    try {
      const sep6Info = await fetchJsonWithTimeout(`${sep6}/info`);
      const { on, off } = extractAssetsMap(sep6Info);
      on.forEach((a) => discoveredOn.add(a));
      off.forEach((a) => discoveredOff.add(a));
    } catch {
      // best effort
    }
  }

  const onCurrencies = configuredCurrencies.length
    ? configuredCurrencies
    : [...discoveredOn];
  const offCurrencies = configuredCurrencies.length
    ? configuredCurrencies
    : [...discoveredOff];

  const onEnabled =
    configuredTypes.length > 0 ? configuredTypes.includes("on-ramp") : onCurrencies.length > 0;
  const offEnabled =
    configuredTypes.length > 0
      ? configuredTypes.includes("off-ramp")
      : offCurrencies.length > 0;

  const anchors = [];

  if (onEnabled) {
    const currencies = onCurrencies.length ? onCurrencies : configuredCurrencies;
    if (!currencies.length) {
      throw new Error(`No on-ramp currencies discovered for ${domain}. Add seed.currencies.`);
    }
    anchors.push({
      name: displayName,
      domain,
      countries,
      currencies,
      type: "on-ramp",
      supports_deposit: true,
      supports_withdraw: false,
      active,
    });
  }

  if (offEnabled) {
    const currencies = offCurrencies.length ? offCurrencies : configuredCurrencies;
    if (!currencies.length) {
      throw new Error(`No off-ramp currencies discovered for ${domain}. Add seed.currencies.`);
    }
    anchors.push({
      name: displayName,
      domain,
      countries,
      currencies,
      type: "off-ramp",
      supports_deposit: false,
      supports_withdraw: true,
      active,
    });
  }

  if (!anchors.length) {
    throw new Error(
      `Could not infer ramp types for ${domain}. Add seed.types and seed.currencies.`
    );
  }

  return anchors;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error ?? `${url} failed`);
  }
  return payload;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.file) {
    throw new Error(
      "Usage: node scripts/import-anchor-seeds.mjs --file ./anchor-seeds.json [--api http://localhost:3001] [--apply] [--no-refresh]"
    );
  }

  const absolute = path.resolve(options.file);
  const raw = await fs.readFile(absolute, "utf-8");
  const seeds = JSON.parse(raw);
  if (!Array.isArray(seeds) || !seeds.length) {
    throw new Error("Seed file must be a non-empty JSON array.");
  }

  const discoveredAnchors = [];
  for (const seed of seeds) {
    const rows = await discoverSeed(seed);
    discoveredAnchors.push(...rows);
  }

  const api = options.apiBaseUrl.replace(/\/+$/, "");
  const importPayload = await postJson(`${api}/api/anchors/ops`, {
    action: "import_directory",
    anchors: discoveredAnchors,
    dryRun: options.dryRun,
  });

  console.log(
    JSON.stringify(
      {
        status: "ok",
        dryRun: options.dryRun,
        discoveredInputRows: discoveredAnchors.length,
        importResult: importPayload,
      },
      null,
      2
    )
  );

  if (!options.dryRun && options.refresh) {
    const refreshPayload = await postJson(`${api}/api/anchors/ops`, {
      action: "refresh_capabilities",
      limit: options.refreshLimit,
    });
    console.log(
      JSON.stringify(
        {
          refresh: {
            requested: options.refreshLimit,
            result: refreshPayload,
          },
        },
        null,
        2
      )
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

