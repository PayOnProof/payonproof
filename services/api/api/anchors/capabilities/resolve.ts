import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../../../lib/http.ts";
import { resolveAnchorCapabilities } from "../../../lib/stellar/capabilities.ts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = readJsonBody(req);
  if (!parsed.ok) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const domain =
    typeof parsed.value.domain === "string" ? parsed.value.domain.trim() : "";
  const assetCode =
    typeof parsed.value.assetCode === "string"
      ? parsed.value.assetCode.trim()
      : "USD";

  if (!domain) {
    return res.status(400).json({ error: "Missing field: domain" });
  }

  try {
    const capabilities = await resolveAnchorCapabilities({ domain, assetCode });
    return res.status(200).json({
      status: "ok",
      capabilities,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({
      status: "error",
      error: message,
    });
  }
}
