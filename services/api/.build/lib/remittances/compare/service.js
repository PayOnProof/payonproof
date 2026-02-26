import { resolveAnchorCapabilities } from "../../stellar/capabilities.js";
import { scoreRoutes } from "./scoring.js";
import { getAnchorsForCorridor, updateAnchorCapabilities, } from "../../repositories/anchors-catalog.js";
import { getFxRate } from "./fx.js";
const BRIDGE_FEE_PERCENT = 0.2;
const CAPABILITY_REFRESH_MS = 10 * 60 * 1000;
const FALLBACK_FEE_PERCENT = Number(process.env.ANCHOR_FALLBACK_FEE_PERCENT ?? 1.5);
const MAX_ROUTES = Math.max(1, Math.min(12, Number(process.env.MAX_COMPARE_ROUTES ?? 12)));
function resolveFeePercentForAmount(fee, amount) {
    if (typeof fee.percent === "number" && Number.isFinite(fee.percent) && fee.percent >= 0) {
        return { percent: fee.percent, estimated: false };
    }
    if (typeof fee.fixed === "number" &&
        Number.isFinite(fee.fixed) &&
        fee.fixed >= 0 &&
        amount > 0) {
        return {
            percent: (fee.fixed / amount) * 100,
            estimated: true,
            reason: "estimated from fixed fee",
        };
    }
    return {
        percent: Number.isFinite(FALLBACK_FEE_PERCENT) && FALLBACK_FEE_PERCENT >= 0
            ? FALLBACK_FEE_PERCENT
            : 1.5,
        estimated: true,
        reason: "fallback estimated fee",
    };
}
async function resolveAnchorRuntime(anchor) {
    const lastCheckedAtMs = anchor.capabilities.lastCheckedAt
        ? Date.parse(anchor.capabilities.lastCheckedAt)
        : Number.NaN;
    const shouldRefresh = !Number.isFinite(lastCheckedAtMs) ||
        Date.now() - lastCheckedAtMs > CAPABILITY_REFRESH_MS;
    if (!shouldRefresh) {
        return {
            catalog: anchor,
            sep: {
                sep24: anchor.capabilities.sep24,
                sep6: anchor.capabilities.sep6,
                sep31: anchor.capabilities.sep31,
            },
            endpoints: {
                webAuthEndpoint: anchor.capabilities.webAuthEndpoint,
                transferServerSep24: anchor.capabilities.transferServerSep24,
                transferServerSep6: anchor.capabilities.transferServerSep6,
                directPaymentServer: anchor.capabilities.directPaymentServer,
            },
            operational: anchor.capabilities.operational,
            diagnostics: anchor.capabilities.diagnostics ?? [],
            fees: {
                fixed: anchor.capabilities.feeFixed,
                percent: anchor.capabilities.feePercent,
                source: anchor.capabilities.feeSource ?? "default",
            },
        };
    }
    try {
        const resolved = await resolveAnchorCapabilities({
            domain: anchor.domain,
            assetCode: anchor.currency,
        });
        // Production remittance flow requires SEP-10 auth + SEP-24 interactive flow.
        const operational = Boolean(resolved.sep.sep10 &&
            resolved.sep.sep24 &&
            resolved.endpoints.webAuthEndpoint &&
            resolved.endpoints.transferServerSep24);
        const runtime = {
            catalog: anchor,
            sep: {
                sep24: resolved.sep.sep24,
                sep6: resolved.sep.sep6,
                sep31: resolved.sep.sep31,
            },
            endpoints: {
                webAuthEndpoint: resolved.endpoints.webAuthEndpoint,
                transferServerSep24: resolved.endpoints.transferServerSep24,
                transferServerSep6: resolved.endpoints.transferServerSep6,
                directPaymentServer: resolved.endpoints.directPaymentServer,
            },
            operational,
            diagnostics: resolved.diagnostics,
            fees: {
                fixed: resolved.fees.fixed,
                percent: resolved.fees.percent,
                source: resolved.fees.source,
            },
        };
        try {
            await updateAnchorCapabilities({
                id: anchor.id,
                sep24: runtime.sep.sep24,
                sep6: runtime.sep.sep6,
                sep31: runtime.sep.sep31,
                sep10: Boolean(runtime.endpoints.webAuthEndpoint),
                operational: runtime.operational,
                feeFixed: runtime.fees.fixed,
                feePercent: runtime.fees.percent,
                feeSource: runtime.fees.source,
                transferServerSep24: runtime.endpoints.transferServerSep24,
                transferServerSep6: runtime.endpoints.transferServerSep6,
                webAuthEndpoint: runtime.endpoints.webAuthEndpoint,
                directPaymentServer: runtime.endpoints.directPaymentServer,
                kycServer: resolved.endpoints.kycServer,
                diagnostics: runtime.diagnostics,
                lastCheckedAt: new Date().toISOString(),
            });
        }
        catch {
            // Do not fail comparison if metadata persistence fails.
        }
        return runtime;
    }
    catch (error) {
        try {
            await updateAnchorCapabilities({
                id: anchor.id,
                sep24: false,
                sep6: false,
                sep31: false,
                sep10: false,
                operational: false,
                diagnostics: [
                    `Capability resolution error: ${error instanceof Error ? error.message : "unknown"}`,
                ],
                lastCheckedAt: new Date().toISOString(),
            });
        }
        catch {
            // Best effort only.
        }
        return {
            catalog: anchor,
            sep: { sep24: false, sep6: false, sep31: false },
            endpoints: {},
            operational: false,
            diagnostics: [
                `Capability resolution error: ${error instanceof Error ? error.message : "unknown"}`,
            ],
            fees: { source: "default" },
        };
    }
}
function buildRoute(input, originAnchor, destinationAnchor, exchangeRate) {
    const onRampFee = resolveFeePercentForAmount(originAnchor.fees, input.amount);
    const offRampFee = resolveFeePercentForAmount(destinationAnchor.fees, input.amount);
    const onRampPercent = onRampFee.percent;
    const offRampPercent = offRampFee.percent;
    const totalPercent = onRampPercent + BRIDGE_FEE_PERCENT + offRampPercent;
    const feeAmount = Number((input.amount * (totalPercent / 100)).toFixed(2));
    const receivedAmount = Number(((input.amount - feeAmount) * exchangeRate).toFixed(2));
    const risks = [];
    if (!originAnchor.sep.sep24 && !originAnchor.sep.sep6) {
        risks.push("Origin anchor without SEP-24/SEP-6");
    }
    if (!destinationAnchor.sep.sep24 && !destinationAnchor.sep.sep6) {
        risks.push("Destination anchor without SEP-24/SEP-6");
    }
    if (!originAnchor.sep.sep31 && !destinationAnchor.sep.sep31) {
        risks.push("No SEP-31 direct-payment signal in selected anchors");
    }
    if (onRampFee.estimated) {
        risks.push(`Origin fee ${onRampFee.reason ?? "estimated"}`);
    }
    if (offRampFee.estimated) {
        risks.push(`Destination fee ${offRampFee.reason ?? "estimated"}`);
    }
    const fastPath = (originAnchor.sep.sep24 || originAnchor.sep.sep6) &&
        (destinationAnchor.sep.sep24 || destinationAnchor.sep.sep6);
    const estimatedMinutes = fastPath ? 8 : 20;
    return {
        id: `route-${originAnchor.catalog.id}-${destinationAnchor.catalog.id}-${Date.now()}`,
        originAnchor: {
            id: originAnchor.catalog.id,
            name: originAnchor.catalog.name,
            country: originAnchor.catalog.country,
            currency: originAnchor.catalog.currency,
            type: "on-ramp",
            status: originAnchor.operational ? "operational" : "offline",
            available: originAnchor.operational,
        },
        destinationAnchor: {
            id: destinationAnchor.catalog.id,
            name: destinationAnchor.catalog.name,
            country: destinationAnchor.catalog.country,
            currency: destinationAnchor.catalog.currency,
            type: "off-ramp",
            status: destinationAnchor.operational ? "operational" : "offline",
            available: destinationAnchor.operational,
        },
        originCountry: input.origin,
        originCurrency: originAnchor.catalog.currency,
        destinationCountry: input.destination,
        destinationCurrency: destinationAnchor.catalog.currency,
        feePercentage: Number(totalPercent.toFixed(2)),
        feeAmount,
        feeBreakdown: {
            onRamp: Number(onRampPercent.toFixed(2)),
            bridge: BRIDGE_FEE_PERCENT,
            offRamp: Number(offRampPercent.toFixed(2)),
        },
        estimatedTime: `${estimatedMinutes} min`,
        estimatedMinutes,
        exchangeRate: Number(exchangeRate.toFixed(6)),
        receivedAmount,
        available: originAnchor.operational && destinationAnchor.operational,
        escrow: true,
        risks,
        recommended: false,
        score: 0,
    };
}
export async function compareRoutesWithAnchors(input) {
    const anchors = await getAnchorsForCorridor({
        origin: input.origin,
        destination: input.destination,
    });
    const runtimes = await Promise.all(anchors.map(resolveAnchorRuntime));
    const originAnchors = runtimes.filter((r) => r.catalog.type === "on-ramp" &&
        r.catalog.country === input.origin &&
        r.operational);
    const destinationAnchors = runtimes.filter((r) => r.catalog.type === "off-ramp" &&
        r.catalog.country === input.destination &&
        r.operational);
    let exchangeRate;
    if (originAnchors.length > 0 && destinationAnchors.length > 0) {
        exchangeRate = await getFxRate(originAnchors[0].catalog.currency, destinationAnchors[0].catalog.currency);
    }
    const routes = [];
    if (exchangeRate !== undefined) {
        for (const originAnchor of originAnchors) {
            for (const destinationAnchor of destinationAnchors) {
                routes.push(buildRoute(input, originAnchor, destinationAnchor, exchangeRate));
            }
        }
    }
    const scored = scoreRoutes(routes).slice(0, MAX_ROUTES);
    return {
        routes: scored,
        meta: {
            origin: input.origin,
            destination: input.destination,
            amount: input.amount,
            queriedAt: new Date().toISOString(),
            anchorDiagnostics: runtimes.map((r) => ({
                anchorId: r.catalog.id,
                domain: r.catalog.domain,
                sep: r.sep,
                operational: r.operational,
                diagnostics: r.diagnostics,
            })),
            noRouteReason: routes.length === 0
                ? "No operational route with real SEP data for this corridor."
                : undefined,
            signingProvider: {
                current: "stellar-sdk",
                futureOption: "trustlesswork",
            },
        },
    };
}
