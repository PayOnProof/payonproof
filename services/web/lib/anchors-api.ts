import { apiUrl } from "./api";
import type { AnchorCountry, RemittanceRoute } from "./types";

export async function fetchAnchorCountries(): Promise<AnchorCountry[]> {
  const response = await fetch(apiUrl("/api/anchors/countries"), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    countries?: AnchorCountry[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Failed to fetch anchor countries");
  }

  return payload.countries ?? [];
}

export async function compareRoutes(params: {
  origin: string;
  destination: string;
  amount: number;
}): Promise<{ routes: RemittanceRoute[]; noRouteReason?: string }> {
  const response = await fetch(apiUrl("/api/compare-routes"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const payload = (await response.json()) as {
    routes?: RemittanceRoute[];
    meta?: { noRouteReason?: string };
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Failed to compare routes");
  }

  return {
    routes: payload.routes ?? [],
    noRouteReason: payload.meta?.noRouteReason,
  };
}
