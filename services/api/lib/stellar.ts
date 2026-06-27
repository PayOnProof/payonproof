import { Horizon } from "@stellar/stellar-sdk";

export type PopEnv = "production" | "staging";

export function getPopEnv(): PopEnv {
  const explicit = (process.env.POP_ENV ?? "").trim().toLowerCase();
  if (explicit === "staging") return "staging";
  if (explicit === "production") return "production";

  const passphrase = (process.env.STELLAR_NETWORK_PASSPHRASE ?? "").trim();
  if (passphrase === "Test SDF Network ; September 2015") {
    return "staging";
  }

  const horizon = (process.env.STELLAR_HORIZON_URL ?? "").trim().toLowerCase();
  if (horizon.includes("horizon-testnet.stellar.org")) {
    return "staging";
  }

  return "production";
}

export function getStellarConfig() {
  const popEnv = getPopEnv();
  const defaultHorizonUrl =
    popEnv === "production"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";
  const defaultPassphrase =
    popEnv === "production"
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
