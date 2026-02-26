const FX_TIMEOUT_MS = 8000;
const FX_CACHE_TTL_MS = 5 * 60 * 1000;
const FX_PROVIDER_URL = process.env.FX_PROVIDER_URL?.trim() ?? "https://api.frankfurter.app/latest";
const FX_FALLBACK_RATE = Number(process.env.FX_FALLBACK_RATE ?? 1);
const fxCache = new Map();
function fallbackRate() {
    return Number.isFinite(FX_FALLBACK_RATE) && FX_FALLBACK_RATE > 0
        ? FX_FALLBACK_RATE
        : 1;
}
function cacheKey(from, to) {
    return `${from.toUpperCase()}-${to.toUpperCase()}`;
}
export async function getFxRate(from, to) {
    const normalizedFrom = from.trim().toUpperCase();
    const normalizedTo = to.trim().toUpperCase();
    if (!normalizedFrom || !normalizedTo) {
        throw new Error("FX requires from/to currency codes");
    }
    if (normalizedFrom === normalizedTo) {
        return 1;
    }
    // Frankfurter supports fiat ISO-4217 codes (typically 3 letters).
    // If assets are token symbols (e.g. EURC/USDC), keep deterministic fallback.
    if (!/^[A-Z]{3}$/.test(normalizedFrom) || !/^[A-Z]{3}$/.test(normalizedTo)) {
        return fallbackRate();
    }
    const key = cacheKey(normalizedFrom, normalizedTo);
    const cached = fxCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.rate;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FX_TIMEOUT_MS);
    try {
        const url = `${FX_PROVIDER_URL}?from=${encodeURIComponent(normalizedFrom)}&to=${encodeURIComponent(normalizedTo)}`;
        const response = await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });
        if (!response.ok) {
            if (response.status === 400 || response.status === 404) {
                return fallbackRate();
            }
            throw new Error(`FX provider error ${response.status} ${response.statusText}`);
        }
        const payload = (await response.json());
        const rate = payload.rates?.[normalizedTo];
        if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
            return fallbackRate();
        }
        fxCache.set(key, {
            rate,
            expiresAt: Date.now() + FX_CACHE_TTL_MS,
        });
        return rate;
    }
    catch {
        return fallbackRate();
    }
    finally {
        clearTimeout(timeout);
    }
}
