import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

export async function connectFreighter() {
  const connected = await isConnected();

  if (!connected) {
    throw new Error("Freighter is not installed");
  }

  await requestAccess();
  const response = await getAddress();
  if (response.error) {
    throw new Error(response.error.message || "Unable to read Freighter address");
  }
  if (!response.address || typeof response.address !== "string") {
    throw new Error("Freighter did not return a valid address");
  }
  return response.address;
}

export async function signFreighterTransaction(input: {
  transactionXdr: string;
  networkPassphrase: string;
  address?: string;
}) {
  const response = await signTransaction(input.transactionXdr, {
    networkPassphrase: input.networkPassphrase,
    address: input.address,
  });

  if (response.error) {
    throw new Error(response.error.message || "Freighter transaction signature failed");
  }

  if (!response.signedTxXdr) {
    throw new Error("Freighter did not return signedTxXdr");
  }

  return response.signedTxXdr;
}

export type StellarWalletNetwork = "mainnet" | "testnet";

function resolveExpectedPassphrase(network: StellarWalletNetwork): string {
  if (network === "mainnet") {
    return "Public Global Stellar Network ; September 2015";
  }
  return "Test SDF Network ; September 2015";
}

export async function ensureFreighterNetwork(
  network: StellarWalletNetwork
): Promise<void> {
  const expectedPassphrase = resolveExpectedPassphrase(network);

  const response = await getNetwork();
  if (response.error) {
    throw new Error(response.error.message || "Unable to read Freighter network");
  }

  const passphrase = response.networkPassphrase;
  if (passphrase !== expectedPassphrase) {
    const expectedLabel = network === "mainnet" ? "Stellar Mainnet" : "Stellar Testnet";
    throw new Error(`Freighter must be connected to ${expectedLabel} for this route.`);
  }
}
