import type { VercelRequest } from "@vercel/node";

type JsonBodyResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false };

export function readJsonBody(req: VercelRequest): JsonBodyResult {
  if (!req.body) {
    return { ok: true, value: {} };
  }

  if (typeof req.body === "object") {
    return { ok: true, value: req.body as Record<string, unknown> };
  }

  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body);
      if (parsed && typeof parsed === "object") {
        return { ok: true, value: parsed as Record<string, unknown> };
      }
      return { ok: true, value: {} };
    } catch {
      return { ok: false };
    }
  }

  return { ok: false };
}
