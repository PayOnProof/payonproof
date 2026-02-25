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
  const address = await getAddress();
  return address;
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

export async function ensureFreighterMainnet(): Promise<void> {
  const popEnv = (process.env.NEXT_PUBLIC_POP_ENV ?? "production").trim().toLowerCase();
  const expectedPassphrase =
    popEnv === "staging"
      ? "Test SDF Network ; September 2015"
      : "Public Global Stellar Network ; September 2015";

  const response = await getNetwork();
  if (response.error) {
    throw new Error(response.error.message || "Unable to read Freighter network");
  }

  const passphrase = response.networkPassphrase;
  if (passphrase !== expectedPassphrase) {
    throw new Error(
      popEnv === "staging"
        ? "Freighter must be connected to Stellar Testnet."
        : "Freighter must be connected to Stellar Mainnet."
    );
  }
}
