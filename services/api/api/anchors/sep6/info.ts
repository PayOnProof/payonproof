import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../../../lib/http.ts";
import { fetchSep6Info } from "../../../lib/stellar/sep6.ts";

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
    typeof parsed.value.domain === "string" ? parsed.value.domain : undefined;
  const transferServerSep6 =
    typeof parsed.value.transferServerSep6 === "string"
      ? parsed.value.transferServerSep6
      : undefined;

  if (!domain && !transferServerSep6) {
    return res.status(400).json({
      error: "Provide domain or transferServerSep6",
    });
  }

  try {
    const result = await fetchSep6Info({
      domain,
      transferServerSep6,
    });
    return res.status(200).json({
      status: "ok",
      mode: "sep6",
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({
      status: "error",
      error: message,
    });
  }
}
