import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handleCorsPreflight } from "../../lib/cors.js";
import { readJsonBody } from "../../lib/http.js";
import {
  createAdminSessionToken,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "../../lib/admin-auth.js";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsPreflight(req, res, ["POST", "OPTIONS"])) return;
  applyCors(req, res, ["POST", "OPTIONS"]);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = readJsonBody(req);
  if (!parsed.ok) return res.status(400).json({ error: "Invalid request body" });

  const email = asString(parsed.value.email);
  const password = asString(parsed.value.password);
  if (!verifyAdminCredentials({ email, password })) {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }

  const token = createAdminSessionToken(email);
  setAdminSessionCookie(res, token);
  return res.status(200).json({ status: "ok", token, user: { email } });
}
