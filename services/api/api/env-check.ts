import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const sep10ClientDomain = process.env.SEP10_CLIENT_DOMAIN ?? "";
  const sep10SendClientDomain = process.env.SEP10_SEND_CLIENT_DOMAIN ?? "";
  const sep10SendHomeDomain = process.env.SEP10_SEND_HOME_DOMAIN ?? "";
  const webOrigin = process.env.WEB_ORIGIN ?? "";

  return res.status(200).json({
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV ?? null,
    hasSupabaseUrl: Boolean(url),
    hasSupabaseServiceRoleKey: Boolean(key),
    supabaseUrlPreview: url ? `${url.slice(0, 24)}...` : null,
    supabaseServiceRolePreview: key ? `${key.slice(0, 16)}...` : null,
    webOrigin: webOrigin || null,
    sep10: {
      hasClientDomain: Boolean(sep10ClientDomain),
      clientDomain: sep10ClientDomain || null,
      sendClientDomain: sep10SendClientDomain || null,
      sendHomeDomain: sep10SendHomeDomain || null,
    },
  });
}

