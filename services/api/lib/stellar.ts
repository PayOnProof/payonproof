import { Horizon } from "@stellar/stellar-sdk";

export function getStellarConfig() {
  return {
    horizonUrl:
      process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
    networkPassphrase:
      process.env.STELLAR_NETWORK_PASSPHRASE ??
      "Test SDF Network ; September 2015",
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
