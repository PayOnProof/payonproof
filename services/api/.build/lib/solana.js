import { Connection } from "@solana/web3.js";
export function getSolanaConnection() {
    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) {
        throw new Error("Missing SOLANA_RPC_URL");
    }
    const commitment = process.env.SOLANA_COMMITMENT ?? "confirmed";
    return new Connection(rpcUrl, commitment);
}
