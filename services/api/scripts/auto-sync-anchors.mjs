#!/usr/bin/env node

const DEFAULT_HOME = "https://anchors.stellar.org/";

function parseArgs(argv) {
  const options = {
    apiBaseUrl: "http://localhost:3001",
    homeUrl: DEFAULT_HOME,
    sourceUrl: "",
    apply: false,
    refresh: true,
    refreshLimit: 300,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--api" && argv[i + 1]) {
      options.apiBaseUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--home" && argv[i + 1]) {
      options.homeUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--source-url" && argv[i + 1]) {
      options.sourceUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--apply") {
      options.apply = true;
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
    }
  }

  return options;
}

async function fetchText(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "text/html,application/json,text/plain,text/csv" },
  });
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json();
  return { ok: res.ok, status: res.status, payload };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function toAbsolute(base, maybeRelative) {
  try {
    return new URL(maybeRelative, base).toString();
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
    if (!absolute) continue;
    links.push(absolute);
  }
  return unique(links);
}

function findNextDataJson(html) {
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

function looksLikeAnchorRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value;
  const hasDomain =
    typeof row.domain === "string" ||
    typeof row.home_domain === "string" ||
    typeof row.homeDomain === "string" ||
    typeof row.website === "string" ||
    typeof row.url === "string";
  const hasAnyMeta =
    row.country ||
    row.countries ||
    row.country_code ||
    row.country_codes ||
    row.currency ||
    row.currencies ||
    row.asset_code ||
    row.asset_codes;
  return Boolean(hasDomain && hasAnyMeta);
}

function collectAnchorLikeArrays(input, out, visited = new Set()) {
  if (!input || typeof input !== "object") return;
  if (visited.has(input)) return;
  visited.add(input);

  if (Array.isArray(input)) {
    if (input.length > 0 && input.every((row) => looksLikeAnchorRecord(row))) {
      out.push(input);
      return;
    }
    for (const item of input) {
      collectAnchorLikeArrays(item, out, visited);
    }
    return;
  }

  for (const value of Object.values(input)) {
    collectAnchorLikeArrays(value, out, visited);
  }
}

async function probeImportByUrl(apiBaseUrl, downloadUrl) {
  const endpoint = `${apiBaseUrl}/api/anchors/ops`;
  const res = await postJson(endpoint, {
    action: "import_directory",
    downloadUrl,
    dryRun: true,
  });
  if (!res.ok) return { ok: false, error: res.payload?.error ?? "unknown error" };
  const normalized = Number(res.payload?.totalNormalized ?? 0);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return { ok: false, error: "zero normalized rows" };
  }
  return { ok: true, normalized, sample: res.payload?.sample ?? [] };
}

async function importAndMaybeRefresh({
  apiBaseUrl,
  anchors,
  sourceUrl,
  apply,
  refresh,
  refreshLimit,
}) {
  const importEndpoint = `${apiBaseUrl}/api/anchors/ops`;
  const importBody = sourceUrl
    ? { action: "import_directory", downloadUrl: sourceUrl, dryRun: !apply }
    : { action: "import_directory", anchors, dryRun: !apply };

  const imported = await postJson(importEndpoint, importBody);
  if (!imported.ok) {
    throw new Error(imported.payload?.error ?? "Import failed");
  }

  if (!apply || !refresh) {
    return { import: imported.payload };
  }

  const refreshEndpoint = `${apiBaseUrl}/api/anchors/ops`;
  const refreshed = await postJson(refreshEndpoint, {
    action: "refresh_capabilities",
    limit: refreshLimit,
  });
  if (!refreshed.ok) {
    throw new Error(refreshed.payload?.error ?? "Capabilities refresh failed");
  }

  return {
    import: imported.payload,
    refresh: refreshed.payload,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const apiBaseUrl = options.apiBaseUrl.replace(/\/+$/, "");
  const homeUrl = options.homeUrl;
  const explicitSource =
    options.sourceUrl.trim() || process.env.STELLAR_ANCHOR_DIRECTORY_URL?.trim() || "";

  const tried = [];

  if (explicitSource) {
    tried.push({ type: "explicit", url: explicitSource });
    const probe = await probeImportByUrl(apiBaseUrl, explicitSource);
    if (probe.ok) {
      const result = await importAndMaybeRefresh({
        apiBaseUrl,
        sourceUrl: explicitSource,
        apply: options.apply,
        refresh: options.refresh,
        refreshLimit: options.refreshLimit,
      });
      console.log(
        JSON.stringify(
          {
            status: "ok",
            strategy: "explicit-source",
            sourceUrl: explicitSource,
            apply: options.apply,
            ...result,
          },
          null,
          2
        )
      );
      return;
    }
  }

  const homeHtml = await fetchText(homeUrl);
  const homeOrigin = new URL(homeUrl).origin;
  const htmlLinks = extractLinksFromHtml(homeUrl, homeHtml);

  const guessedEndpoints = [
    `${homeOrigin}/anchors.json`,
    `${homeOrigin}/api/anchors`,
    `${homeOrigin}/api/v1/anchors`,
    `${homeOrigin}/api/directory/anchors`,
    `${homeOrigin}/directory/anchors.json`,
    `${homeOrigin}/exports/anchors.json`,
  ];

  const urlCandidates = unique([
    ...htmlLinks.filter((u) => /\.(json|csv)(\?|$)/i.test(u)),
    ...htmlLinks.filter((u) => /anchor|directory|export/i.test(u)),
    ...guessedEndpoints,
  ]);

  for (const candidate of urlCandidates) {
    tried.push({ type: "url-candidate", url: candidate });
    try {
      const probe = await probeImportByUrl(apiBaseUrl, candidate);
      if (probe.ok) {
        const result = await importAndMaybeRefresh({
          apiBaseUrl,
          sourceUrl: candidate,
          apply: options.apply,
          refresh: options.refresh,
          refreshLimit: options.refreshLimit,
        });
        console.log(
          JSON.stringify(
            {
              status: "ok",
              strategy: "discovered-url",
              sourceUrl: candidate,
              apply: options.apply,
              ...result,
            },
            null,
            2
          )
        );
        return;
      }
    } catch (error) {
      tried.push({
        type: "url-candidate-error",
        url: candidate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const nextData = findNextDataJson(homeHtml);
  if (nextData) {
    const arrays = [];
    collectAnchorLikeArrays(nextData, arrays);
    if (arrays.length > 0) {
      const best = arrays.sort((a, b) => b.length - a.length)[0];
      const result = await importAndMaybeRefresh({
        apiBaseUrl,
        anchors: best,
        apply: options.apply,
        refresh: options.refresh,
        refreshLimit: options.refreshLimit,
      });
      console.log(
        JSON.stringify(
          {
            status: "ok",
            strategy: "next-data-inline-array",
            sourceUrl: homeUrl,
            inputRows: best.length,
            apply: options.apply,
            ...result,
          },
          null,
          2
        )
      );
      return;
    }
  }

  throw new Error(
    `Auto-discovery failed. Tried ${tried.length} candidates. Set STELLAR_ANCHOR_DIRECTORY_URL or pass --source-url if you have a direct export endpoint.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

