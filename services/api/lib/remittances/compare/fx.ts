const FX_TIMEOUT_MS = 8000;
const FX_CACHE_TTL_MS = 5 * 60 * 1000;
const FX_PROVIDER_URL =
  process.env.FX_PROVIDER_URL?.trim() ?? "https://api.frankfurter.app/latest";

interface FxCacheValue {
  rate: number;
  expiresAt: number;
}

const fxCache = new Map<string, FxCacheValue>();

function cacheKey(from: string, to: string): string {
  return `${from.toUpperCase()}-${to.toUpperCase()}`;
}

export async function getFxRate(from: string, to: string): Promise<number> {
  const normalizedFrom = from.trim().toUpperCase();
  const normalizedTo = to.trim().toUpperCase();
  if (!normalizedFrom || !normalizedTo) {
    throw new Error("FX requires from/to currency codes");
  }

  if (normalizedFrom === normalizedTo) {
    return 1;
  }

  const key = cacheKey(normalizedFrom, normalizedTo);
  const cached = fxCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rate;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FX_TIMEOUT_MS);

  try {
    const url = `${FX_PROVIDER_URL}?from=${encodeURIComponent(
      normalizedFrom
    )}&to=${encodeURIComponent(normalizedTo)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`FX provider error ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      rates?: Record<string, number>;
    };
    const rate = payload.rates?.[normalizedTo];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("FX provider returned invalid rate");
    }

    fxCache.set(key, {
      rate,
      expiresAt: Date.now() + FX_CACHE_TTL_MS,
    });

    return rate;
  } finally {
    clearTimeout(timeout);
  }
}
