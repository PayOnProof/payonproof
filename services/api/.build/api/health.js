import { getLatestLedgerSequence, getStellarConfig } from "../lib/stellar.js";
async function withTimeout(promise, timeoutMs) {
    return await Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Horizon timeout")), timeoutMs)),
    ]);
}
export default async function handler(_req, res) {
    const { horizonUrl } = getStellarConfig();
    try {
        const ledger = await withTimeout(getLatestLedgerSequence(), 5000);
        return res.status(200).json({
            status: "ok",
            version: "0.1.0",
            timestamp: new Date().toISOString(),
            services: {
                stellar: "ok",
                supabase: "placeholder",
                anchors: "placeholder",
            },
            stellar: {
                horizonUrl,
                latestLedger: ledger,
            },
        });
    }
    catch (error) {
        const message = (() => {
            if (!(error instanceof Error))
                return "Unknown Horizon error";
            if (error.message?.trim())
                return error.message;
            const cause = error.cause;
            if (cause instanceof Error && cause.message?.trim())
                return cause.message;
            return "Unknown Horizon error";
        })();
        return res.status(503).json({
            status: "degraded",
            version: "0.1.0",
            timestamp: new Date().toISOString(),
            services: {
                stellar: "error",
                supabase: "placeholder",
                anchors: "placeholder",
            },
            stellar: {
                horizonUrl,
                error: message,
            },
        });
    }
}
