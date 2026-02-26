import { Horizon } from "@stellar/stellar-sdk";
export function getPopEnv() {
    const raw = (process.env.POP_ENV ?? "production").trim().toLowerCase();
    return raw === "staging" ? "staging" : "production";
}
export function getStellarConfig() {
    const popEnv = getPopEnv();
    const defaultHorizonUrl = popEnv === "production"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org";
    const defaultPassphrase = popEnv === "production"
        ? "Public Global Stellar Network ; September 2015"
        : "Test SDF Network ; September 2015";
    return {
        popEnv,
        horizonUrl: process.env.STELLAR_HORIZON_URL ?? defaultHorizonUrl,
        networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE ?? defaultPassphrase,
    };
}
export function getHorizonServer() {
    const { horizonUrl } = getStellarConfig();
    return new Horizon.Server(horizonUrl);
}
export async function getLatestLedgerSequence() {
    const server = getHorizonServer();
    const ledgers = await server.ledgers().order("desc").limit(1).call();
    const latest = ledgers.records[0];
    if (!latest) {
        throw new Error("No ledger records returned by Horizon");
    }
    return Number(latest.sequence);
}
