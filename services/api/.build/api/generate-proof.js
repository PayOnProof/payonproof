import { readJsonBody } from "../lib/http.js";
import { getStellarConfig } from "../lib/stellar.js";
import { applyCors, handleCorsPreflight } from "../lib/cors.js";
/**
 * POST /api/generate-proof
 *
 * Accepts: {
 *   transactionId: string,
 *   stellarTxHash: string,
 *   route?: string,
 *   originAmount?: number,
 *   originCurrency?: string,
 *   destinationAmount?: number,
 *   destinationCurrency?: string,
 *   exchangeRate?: number,
 *   totalFees?: number
 * }
 * Verifies the transaction exists in Horizon before issuing proof payload.
 */
function asString(value) {
    return typeof value === "string" ? value.trim() : "";
}
function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function normalizeHash(value) {
    return value.trim();
}
async function verifyTransactionOnHorizon(hash) {
    const { horizonUrl } = getStellarConfig();
    const endpoint = `${horizonUrl.replace(/\/+$/, "")}/transactions/${encodeURIComponent(hash)}`;
    let response;
    try {
        response = await fetch(endpoint, {
            method: "GET",
            headers: { Accept: "application/json" },
        });
    }
    catch (error) {
        const message = error instanceof Error && error.message ? error.message : "network error";
        throw new Error(`Horizon request failed (${endpoint}): ${message}`);
    }
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Transaction not found on Horizon (${response.status}): ${body || response.statusText}`);
    }
}
export default async function handler(req, res) {
    if (handleCorsPreflight(req, res, ["POST", "OPTIONS"]))
        return;
    applyCors(req, res, ["POST", "OPTIONS"]);
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    const parsed = readJsonBody(req);
    if (!parsed.ok) {
        return res.status(400).json({ error: "Invalid request body" });
    }
    const transactionId = asString(parsed.value.transactionId);
    const stellarTxHash = normalizeHash(asString(parsed.value.stellarTxHash));
    if (!transactionId) {
        return res.status(400).json({ error: "Missing field: transactionId" });
    }
    if (!stellarTxHash) {
        return res.status(400).json({ error: "Missing field: stellarTxHash" });
    }
    try {
        await verifyTransactionOnHorizon(stellarTxHash);
        return res.status(200).json({
            proof: {
                id: `POP-PROOF-${Date.now()}`,
                transactionId,
                timestamp: new Date().toISOString(),
                sender: "Wallet Holder",
                receiver: "Anchor Settlement",
                originAmount: asNumber(parsed.value.originAmount) ?? 0,
                originCurrency: asString(parsed.value.originCurrency) || "USDC",
                destinationAmount: asNumber(parsed.value.destinationAmount) ?? 0,
                destinationCurrency: asString(parsed.value.destinationCurrency) || "USDC",
                exchangeRate: asNumber(parsed.value.exchangeRate) ?? 1,
                totalFees: asNumber(parsed.value.totalFees) ?? 0,
                route: asString(parsed.value.route) || "Anchor route",
                stellarTxHash,
                status: "verified",
                verificationUrl: `https://stellar.expert/explorer/public/tx/${stellarTxHash}`,
            },
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return res.status(502).json({ error: message });
    }
}
