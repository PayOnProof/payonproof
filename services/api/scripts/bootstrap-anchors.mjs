#!/usr/bin/env node

function parseArgs(argv) {
  const options = {
    api: "http://localhost:3001",
    downloadUrl: "",
    file: "",
    refreshLimit: 300,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--api" && argv[i + 1]) {
      options.api = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--download-url" && argv[i + 1]) {
      options.downloadUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--file" && argv[i + 1]) {
      options.file = argv[i + 1];
      i += 1;
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

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed: ${url}`);
  }
  return payload;
}

async function loadAnchorsFromFile(filePath) {
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(filePath, "utf-8");

  const trimmed = raw.trim();
  if (!trimmed) return [];

  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    for (const key of ["anchors", "data", "items", "results"]) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
  }
  return [];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const api = options.api.replace(/\/+$/, "");
  const downloadUrl =
    options.downloadUrl || process.env.STELLAR_ANCHOR_DIRECTORY_URL || "";

  if (!downloadUrl && !options.file) {
    throw new Error(
      "Missing source. Use --download-url <url> OR --file <anchors.json> OR STELLAR_ANCHOR_DIRECTORY_URL."
    );
  }

  let importBody;
  if (options.file) {
    const anchors = await loadAnchorsFromFile(options.file);
    if (!anchors.length) {
      throw new Error("File has no anchors array (use JSON array or {anchors:[...]}).");
    }
    importBody = { anchors };
  } else {
    importBody = { downloadUrl };
  }

  console.log("[1/3] Validating import source...");
  await postJson(`${api}/api/anchors/ops`, {
    action: "import_directory",
    ...importBody,
    dryRun: true,
  });

  console.log("[2/3] Importing anchors into Supabase...");
  const imported = await postJson(`${api}/api/anchors/ops`, {
    action: "import_directory",
    ...importBody,
    dryRun: false,
  });
  console.log(
    `Imported: normalized=${imported.totalNormalized}, written=${imported.written}`
  );

  console.log("[3/3] Refreshing SEP capabilities...");
  const refreshed = await postJson(`${api}/api/anchors/ops`, {
    action: "refresh_capabilities",
    limit: options.refreshLimit,
  });
  console.log(
    `Refreshed: total=${refreshed.refreshed}, ok=${refreshed.ok}, errors=${refreshed.errors}`
  );

  console.log("DONE");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
