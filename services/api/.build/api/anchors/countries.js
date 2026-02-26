import { listActiveAnchors } from "../../lib/repositories/anchors-catalog.js";
const countryNames = typeof Intl !== "undefined" &&
    typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;
export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    try {
        const includeNonOperational = req.query &&
            (req.query.includeNonOperational === "true" ||
                req.query.includeNonOperational === "1");
        const anchors = await listActiveAnchors();
        const grouped = new Map();
        for (const anchor of anchors) {
            const code = anchor.country.toUpperCase();
            const current = grouped.get(code) ?? {
                code,
                name: countryNames?.of(code) ?? code,
                currencies: [],
                onRampCount: 0,
                offRampCount: 0,
                operationalAnchors: 0,
            };
            if (!current.currencies.includes(anchor.currency)) {
                current.currencies.push(anchor.currency);
            }
            if (anchor.type === "on-ramp")
                current.onRampCount += 1;
            if (anchor.type === "off-ramp")
                current.offRampCount += 1;
            if (anchor.capabilities.operational)
                current.operationalAnchors += 1;
            grouped.set(code, current);
        }
        const countries = [...grouped.values()]
            .filter((country) => country.code !== "ZZ")
            .filter((country) => includeNonOperational ? true : country.operationalAnchors > 0)
            .filter((country) => country.onRampCount > 0 || country.offRampCount > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
        return res.status(200).json({ countries });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return res.status(500).json({ error: message });
    }
}
