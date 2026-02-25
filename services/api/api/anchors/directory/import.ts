import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../../../lib/http.ts";
import { loadAnchorDirectory } from "../../../lib/stellar/anchor-directory.ts";
import { upsertAnchorsCatalog } from "../../../lib/repositories/anchors-catalog.ts";

function parseAllowedDomainsFromEnv(): string[] {
  const raw = process.env.ANCHOR_DIRECTORY_ALLOWED_DOMAINS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = readJsonBody(req);
  if (!parsed.ok) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const body = parsed.value;
  const dryRun = body.dryRun !== false;
  const active = body.active !== false;
  const downloadUrl =
    typeof body.downloadUrl === "string" ? body.downloadUrl.trim() : undefined;
  const anchors = Array.isArray(body.anchors) ? body.anchors : undefined;
  const strictDirectory = body.strictDirectory !== false;
  const bodyAllowedDomains = Array.isArray(body.allowedDomains)
    ? body.allowedDomains.filter((d): d is string => typeof d === "string")
    : [];
  const allowedDomains =
    bodyAllowedDomains.length > 0
      ? bodyAllowedDomains
      : parseAllowedDomainsFromEnv();
  const requireAllowedDomains = strictDirectory && Boolean(downloadUrl);

  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({
      status: "error",
      error: message,
    });
  }
}
