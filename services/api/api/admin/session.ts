import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handleCorsPreflight } from "../../lib/cors.js";
import { getAdminSession } from "../../lib/admin-auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsPreflight(req, res, ["GET", "OPTIONS"])) return;
  applyCors(req, res, ["GET", "OPTIONS"]);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = getAdminSession(req);
  return res.status(200).json({
    authenticated: Boolean(session),
    user: session ? { email: session.email } : null,
  });
}
