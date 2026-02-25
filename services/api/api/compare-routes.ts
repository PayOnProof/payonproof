import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../lib/http";
import { parseCompareRoutesInput } from "../lib/remittances/compare/schema";
import { compareRoutesWithAnchors } from "../lib/remittances/compare/service";

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

  const parsedInput = parseCompareRoutesInput(parsed.value);
  if (!parsedInput.ok) {
    return res.status(400).json({ error: parsedInput.error });
  }

  try {
    const result = await compareRoutesWithAnchors(parsedInput.value);
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
