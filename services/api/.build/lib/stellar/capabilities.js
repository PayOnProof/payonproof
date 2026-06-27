import { discoverAnchorFromDomain } from "./sep1.js";
import { fetchSep24Info } from "./sep24.js";
import { fetchSep6Info } from "./sep6.js";
function toNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return undefined;
}
function extractFeeFromInfo(info, assetCode) {
    if (!info || typeof info !== "object")
        return undefined;
    const root = info;
    const deposit = root.deposit;
    const withdraw = root.withdraw;
    const candidates = [
        deposit?.[assetCode],
        withdraw?.[assetCode],
        deposit?.[`${assetCode}:*`],
        withdraw?.[`${assetCode}:*`],
    ];
    const found = candidates.find((v) => v && typeof v === "object");
    if (!found)
        return undefined;
    return {
        fixed: toNumber(found.fee_fixed),
        percent: toNumber(found.fee_percent),
    };
}
export async function resolveAnchorCapabilities(input) {
    const diagnostics = [];
    const sep1 = await discoverAnchorFromDomain({ domain: input.domain });
    const sep = {
        sep24: Boolean(sep1.transferServerSep24),
        sep6: Boolean(sep1.transferServerSep6),
        sep31: Boolean(sep1.directPaymentServer),
        sep10: Boolean(sep1.webAuthEndpoint),
    };
    let sep24Info;
    let sep6Info;
    let fees = {
        source: "default",
    };
    if (sep1.transferServerSep24) {
        try {
            const r = await fetchSep24Info({
                transferServerSep24: sep1.transferServerSep24,
            });
            sep24Info = r.info;
            const extracted = extractFeeFromInfo(r.info, input.assetCode);
            if (extracted?.fixed !== undefined || extracted?.percent !== undefined) {
                fees = { ...extracted, source: "sep24" };
            }
        }
        catch (error) {
            diagnostics.push(`SEP-24 /info error: ${error instanceof Error ? error.message : "unknown"}`);
        }
    }
    else {
        diagnostics.push("SEP-24 endpoint missing in stellar.toml");
    }
    if (sep1.transferServerSep6) {
        try {
            const r = await fetchSep6Info({
                transferServerSep6: sep1.transferServerSep6,
            });
            sep6Info = r.info;
            if (fees.source === "default") {
                const extracted = extractFeeFromInfo(r.info, input.assetCode);
                if (extracted?.fixed !== undefined || extracted?.percent !== undefined) {
                    fees = { ...extracted, source: "sep6" };
                }
            }
        }
        catch (error) {
            diagnostics.push(`SEP-6 /info error: ${error instanceof Error ? error.message : "unknown"}`);
        }
    }
    else {
        diagnostics.push("SEP-6 endpoint missing in stellar.toml");
    }
    if (!sep.sep31)
        diagnostics.push("SEP-31 endpoint missing in stellar.toml");
    return {
        domain: sep1.domain,
        sep,
        endpoints: {
            webAuthEndpoint: sep1.webAuthEndpoint,
            transferServerSep24: sep1.transferServerSep24,
            transferServerSep6: sep1.transferServerSep6,
            directPaymentServer: sep1.directPaymentServer,
            kycServer: sep1.kycServer,
        },
        fees,
        diagnostics,
        raw: {
            signingKey: sep1.signingKey,
            sep24Info,
            sep6Info,
        },
    };
}
