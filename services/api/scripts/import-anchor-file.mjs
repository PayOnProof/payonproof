#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const result = {
    file: "",
    apiBaseUrl: "http://localhost:3001",
    dryRun: true,
    active: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file" && argv[i + 1]) {
      result.file = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--api" && argv[i + 1]) {
      result.apiBaseUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--apply") {
      result.dryRun = false;
      continue;
    }
    if (arg === "--inactive") {
      result.active = false;
      continue;
    }
  }

  return result;
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

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function normalizeArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const key of ["anchors", "data", "items", "results"]) {
      if (Array.isArray(payload[key])) return payload[key];
    }
  }
  return [];
}

async function readAnchorsFromFile(filePath) {
  const absolute = path.resolve(filePath);
  const raw = await fs.readFile(absolute, "utf-8");
  const lower = absolute.toLowerCase();

  if (lower.endsWith(".csv")) {
    return parseCsv(raw);
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeArrayPayload(parsed);
  } catch {
    return parseCsv(raw);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.file) {
    console.error(
      "Usage: node scripts/import-anchor-file.mjs --file <anchors.json|anchors.csv> [--api http://localhost:3001] [--apply]"
    );
    process.exit(1);
  }

  const anchors = await readAnchorsFromFile(options.file);
  if (!anchors.length) {
    console.error("No anchors found in file.");
    process.exit(1);
  }

  const endpoint = `${options.apiBaseUrl.replace(/\/+$/, "")}/api/anchors/directory/import`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dryRun: options.dryRun,
      active: options.active,
      anchors,
    }),
  });

  const payload = await response.json();
  console.log(JSON.stringify(payload, null, 2));

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
