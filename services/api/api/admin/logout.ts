import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handleCorsPreflight } from "../../lib/cors.js";
import { clearAdminSessionCookie } from "../../lib/admin-auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsPreflight(req, res, ["POST", "OPTIONS"])) return;
  applyCors(req, res, ["POST", "OPTIONS"]);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  clearAdminSessionCookie(res);
  return res.status(200).json({ status: "ok" });
}
