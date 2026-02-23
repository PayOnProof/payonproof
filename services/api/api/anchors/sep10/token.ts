import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../../../lib/http.ts";
import { requestSep10Token } from "../../../lib/stellar/sep10.ts";

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
  const webAuthEndpoint =
    typeof parsed.value.webAuthEndpoint === "string"
      ? parsed.value.webAuthEndpoint
      : undefined;
  const serverSigningKey =
    typeof parsed.value.serverSigningKey === "string"
      ? parsed.value.serverSigningKey
      : undefined;
  const accountPublicKey =
    typeof parsed.value.accountPublicKey === "string"
      ? parsed.value.accountPublicKey
      : undefined;
  const homeDomain =
    typeof parsed.value.homeDomain === "string"
      ? parsed.value.homeDomain
      : undefined;
  const clientDomain =
    typeof parsed.value.clientDomain === "string"
      ? parsed.value.clientDomain
      : undefined;

  const secretKey = process.env.STELLAR_ESCROW_SECRET?.trim();
  if (!secretKey) {
    return res.status(400).json({
      error:
        "Missing STELLAR_ESCROW_SECRET in backend env. Required for SEP-10 signing.",
    });
  }

  if (!domain && !webAuthEndpoint) {
    return res.status(400).json({
      error: "Provide domain or webAuthEndpoint",
    });
  }

  try {
    const token = await requestSep10Token({
      domain,
      webAuthEndpoint,
      serverSigningKey,
      secretKey,
      accountPublicKey,
      homeDomain,
      clientDomain,
    });

    return res.status(200).json({
      status: "ok",
      token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({
      status: "error",
      error: message,
    });
  }
}
