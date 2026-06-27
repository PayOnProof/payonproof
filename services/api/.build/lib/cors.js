function parseAllowedOrigins() {
    const explicit = process.env.CORS_ALLOWED_ORIGINS?.trim() ?? "";
    const fallback = process.env.WEB_ORIGIN?.trim() ?? "";
    const raw = explicit || fallback;
    if (!raw)
        return [];
    return raw
        .split(",")
        .map((item) => item.trim().replace(/\/+$/, ""))
        .filter(Boolean);
}
function resolveOrigin(req) {
    const requestOrigin = (req.headers.origin ?? "")
        .trim()
        .replace(/\/+$/, "");
    const allowed = parseAllowedOrigins();
    if (allowed.length === 0)
        return requestOrigin || "*";
    if (requestOrigin && allowed.includes(requestOrigin))
        return requestOrigin;
    return allowed[0];
}
export function applyCors(req, res, methods) {
    const origin = resolveOrigin(req);
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", methods.join(","));
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Max-Age", "600");
}
export function handleCorsPreflight(req, res, methods) {
    applyCors(req, res, methods);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true;
    }
    return false;
}
