export function readJsonBody(req) {
    if (!req.body) {
        return { ok: true, value: {} };
    }
    if (typeof req.body === "object") {
        return { ok: true, value: req.body };
    }
    if (typeof req.body === "string") {
        try {
            const parsed = JSON.parse(req.body);
            if (parsed && typeof parsed === "object") {
                return { ok: true, value: parsed };
            }
            return { ok: true, value: {} };
        }
        catch {
            return { ok: false };
        }
    }
    return { ok: false };
}
