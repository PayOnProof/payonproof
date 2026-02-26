export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    const url = process.env.SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    return res.status(200).json({
        cwd: process.cwd(),
        nodeEnv: process.env.NODE_ENV ?? null,
        hasSupabaseUrl: Boolean(url),
        hasSupabaseServiceRoleKey: Boolean(key),
        supabaseUrlPreview: url ? `${url.slice(0, 24)}...` : null,
        supabaseServiceRolePreview: key ? `${key.slice(0, 16)}...` : null,
    });
}
