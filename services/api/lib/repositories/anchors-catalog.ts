import { getSupabaseAdmin } from "../supabase";
import type { AnchorCatalogEntry } from "../remittances/compare/types";
import type { AnchorCatalogImportRow } from "../stellar/anchor-directory";

interface AnchorCatalogRow {
  id: string;
  name: string;
  domain: string;
  country: string;
  currency: string;
  type: "on-ramp" | "off-ramp";
  active: boolean;
  sep24?: boolean | null;
  sep6?: boolean | null;
  sep31?: boolean | null;
  sep10?: boolean | null;
  operational?: boolean | null;
  fee_fixed?: number | null;
  fee_percent?: number | null;
  fee_source?: "sep24" | "sep6" | "default" | null;
  transfer_server_sep24?: string | null;
  transfer_server_sep6?: string | null;
  web_auth_endpoint?: string | null;
  direct_payment_server?: string | null;
  kyc_server?: string | null;
  last_checked_at?: string | null;
  diagnostics?: string[] | null;
}

interface CapabilityUpdateInput {
  id: string;
  sep24: boolean;
  sep6: boolean;
  sep31: boolean;
  sep10: boolean;
  operational: boolean;
  feeFixed?: number;
  feePercent?: number;
  feeSource?: "sep24" | "sep6" | "default";
  transferServerSep24?: string;
  transferServerSep6?: string;
  webAuthEndpoint?: string;
  directPaymentServer?: string;
  kycServer?: string;
  diagnostics?: string[];
  lastCheckedAt: string;
}

export async function getAnchorsForCorridor(input: {
  origin: string;
  destination: string;
}): Promise<AnchorCatalogEntry[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("anchors_catalog")
    .select(
      "id,name,domain,country,currency,type,active,sep24,sep6,sep31,sep10,operational,fee_fixed,fee_percent,fee_source,transfer_server_sep24,transfer_server_sep6,web_auth_endpoint,direct_payment_server,kyc_server,last_checked_at,diagnostics"
    )
    .eq("active", true)
    .in("country", [input.origin, input.destination])
    .in("type", ["on-ramp", "off-ramp"]);

  if (error) {
    throw new Error(`anchors_catalog query failed: ${error.message}`);
  }

  const rows = (data ?? []) as AnchorCatalogRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    country: row.country,
    currency: row.currency,
    type: row.type,
    capabilities: {
      sep24: Boolean(row.sep24),
      sep6: Boolean(row.sep6),
      sep31: Boolean(row.sep31),
      sep10: Boolean(row.sep10),
      operational: Boolean(row.operational),
      feeFixed: row.fee_fixed ?? undefined,
      feePercent: row.fee_percent ?? undefined,
      feeSource: row.fee_source ?? undefined,
      transferServerSep24: row.transfer_server_sep24 ?? undefined,
      transferServerSep6: row.transfer_server_sep6 ?? undefined,
      webAuthEndpoint: row.web_auth_endpoint ?? undefined,
      directPaymentServer: row.direct_payment_server ?? undefined,
      kycServer: row.kyc_server ?? undefined,
      lastCheckedAt: row.last_checked_at ?? undefined,
      diagnostics: row.diagnostics ?? undefined,
    },
  }));
}

export async function upsertAnchorsCatalog(
  rows: AnchorCatalogImportRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const supabase = getSupabaseAdmin();
  const chunkSize = 500;
  let total = 0;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase
      .from("anchors_catalog")
      .upsert(chunk, { onConflict: "id" });

    if (error) {
      throw new Error(`anchors_catalog upsert failed: ${error.message}`);
    }

    total += chunk.length;
  }

  return total;
}

export async function listActiveAnchors(): Promise<AnchorCatalogEntry[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("anchors_catalog")
    .select(
      "id,name,domain,country,currency,type,active,sep24,sep6,sep31,sep10,operational,fee_fixed,fee_percent,fee_source,transfer_server_sep24,transfer_server_sep6,web_auth_endpoint,direct_payment_server,kyc_server,last_checked_at,diagnostics"
    )
    .eq("active", true)
    .order("country", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`anchors_catalog list failed: ${error.message}`);
  }

  const rows = (data ?? []) as AnchorCatalogRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    country: row.country,
    currency: row.currency,
    type: row.type,
    capabilities: {
      sep24: Boolean(row.sep24),
      sep6: Boolean(row.sep6),
      sep31: Boolean(row.sep31),
      sep10: Boolean(row.sep10),
      operational: Boolean(row.operational),
      feeFixed: row.fee_fixed ?? undefined,
      feePercent: row.fee_percent ?? undefined,
      feeSource: row.fee_source ?? undefined,
      transferServerSep24: row.transfer_server_sep24 ?? undefined,
      transferServerSep6: row.transfer_server_sep6 ?? undefined,
      webAuthEndpoint: row.web_auth_endpoint ?? undefined,
      directPaymentServer: row.direct_payment_server ?? undefined,
      kycServer: row.kyc_server ?? undefined,
      lastCheckedAt: row.last_checked_at ?? undefined,
      diagnostics: row.diagnostics ?? undefined,
    },
  }));
}

export async function updateAnchorCapabilities(
  input: CapabilityUpdateInput
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("anchors_catalog")
    .update({
      sep24: input.sep24,
      sep6: input.sep6,
      sep31: input.sep31,
      sep10: input.sep10,
      operational: input.operational,
      fee_fixed: input.feeFixed ?? null,
      fee_percent: input.feePercent ?? null,
      fee_source: input.feeSource ?? "default",
      transfer_server_sep24: input.transferServerSep24 ?? null,
      transfer_server_sep6: input.transferServerSep6 ?? null,
      web_auth_endpoint: input.webAuthEndpoint ?? null,
      direct_payment_server: input.directPaymentServer ?? null,
      kyc_server: input.kycServer ?? null,
      diagnostics: input.diagnostics ?? [],
      last_checked_at: input.lastCheckedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(`anchors_catalog capability update failed: ${error.message}`);
  }
}

export async function setAnchorActive(input: {
  id: string;
  active: boolean;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("anchors_catalog")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(`anchors_catalog active update failed: ${error.message}`);
  }
}
