import { getSupabaseAdmin } from "../supabase.js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
let localFallbackCache = null;
function localFallbackFilePath() {
    const candidates = [
        path.join(process.cwd(), "data", "anchors-export.json"),
        path.join(process.cwd(), "services", "api", "data", "anchors-export.json"),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    return candidates[0];
}
function loadLocalFallbackAnchors() {
    if (localFallbackCache)
        return localFallbackCache;
    const filePath = localFallbackFilePath();
    if (!existsSync(filePath)) {
        localFallbackCache = [];
        return localFallbackCache;
    }
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const out = [];
    for (const row of parsed.anchors ?? []) {
        const domain = (row.domain ?? "").trim().toLowerCase();
        const name = (row.name ?? "").trim();
        const type = row.type;
        const active = row.active !== false;
        const countries = (row.countries ?? []).map((c) => (c ?? "").trim().toUpperCase());
        const currencies = (row.currencies ?? []).map((c) => (c ?? "").trim().toUpperCase());
        if (!domain || !name || !type || !active)
            continue;
        if (countries.length === 0 || currencies.length === 0)
            continue;
        for (const country of countries) {
            if (!country)
                continue;
            for (const currency of currencies) {
                if (!currency)
                    continue;
                out.push({
                    id: `${domain}:${type}:${country}:${currency}`,
                    name,
                    domain,
                    country,
                    currency,
                    type,
                    capabilities: {
                        sep24: false,
                        sep6: false,
                        sep31: false,
                        sep10: false,
                        operational: false,
                    },
                });
            }
        }
    }
    localFallbackCache = out;
    return localFallbackCache;
}
export async function getAnchorsForCorridor(input) {
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from("anchors_catalog")
            .select("id,name,domain,country,currency,type,active,sep24,sep6,sep31,sep10,operational,fee_fixed,fee_percent,fee_source,transfer_server_sep24,transfer_server_sep6,web_auth_endpoint,direct_payment_server,kyc_server,last_checked_at,diagnostics")
            .eq("active", true)
            .in("country", [input.origin, input.destination])
            .in("type", ["on-ramp", "off-ramp"]);
        if (error) {
            throw new Error(`anchors_catalog query failed: ${error.message}`);
        }
        const rows = (data ?? []);
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
    catch {
        const fallback = loadLocalFallbackAnchors();
        return fallback.filter((anchor) => anchor.country === input.origin || anchor.country === input.destination);
    }
}
export async function upsertAnchorsCatalog(rows) {
    if (rows.length === 0)
        return 0;
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
export async function listActiveAnchors() {
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from("anchors_catalog")
            .select("id,name,domain,country,currency,type,active,sep24,sep6,sep31,sep10,operational,fee_fixed,fee_percent,fee_source,transfer_server_sep24,transfer_server_sep6,web_auth_endpoint,direct_payment_server,kyc_server,last_checked_at,diagnostics")
            .eq("active", true)
            .order("country", { ascending: true })
            .order("name", { ascending: true });
        if (error) {
            throw new Error(`anchors_catalog list failed: ${error.message}`);
        }
        const rows = (data ?? []);
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
    catch {
        return loadLocalFallbackAnchors();
    }
}
export async function updateAnchorCapabilities(input) {
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
export async function setAnchorActive(input) {
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
