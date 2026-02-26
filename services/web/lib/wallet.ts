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

function resolveExpectedPassphrase(): {
  passphrase: string;
  envLabel: "staging" | "production";
} {
  const explicit = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE?.trim();
  if (explicit) {
    const envLabel =
      explicit === "Test SDF Network ; September 2015" ? "staging" : "production";
    return { passphrase: explicit, envLabel };
  }
  const popEnv = (process.env.NEXT_PUBLIC_POP_ENV ?? "staging").trim().toLowerCase();
  if (popEnv === "production") {
    return {
      passphrase: "Public Global Stellar Network ; September 2015",
      envLabel: "production",
    };
  }
  return {
    passphrase: "Test SDF Network ; September 2015",
    envLabel: "staging",
  };
}

export async function ensureFreighterMainnet(): Promise<void> {
  const expected = resolveExpectedPassphrase();

  const response = await getNetwork();
  if (response.error) {
    throw new Error(response.error.message || "Unable to read Freighter network");
  }

  const passphrase = response.networkPassphrase;
  if (passphrase !== expected.passphrase) {
    throw new Error(
      expected.envLabel === "staging"
        ? "Freighter must be connected to Stellar Testnet. Set NEXT_PUBLIC_POP_ENV=staging in web env if needed."
        : "Freighter must be connected to Stellar Mainnet. Set NEXT_PUBLIC_POP_ENV=production in web env if needed."
    );
  }
}
