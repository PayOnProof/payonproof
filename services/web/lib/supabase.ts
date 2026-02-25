import { createClient } from "@supabase/supabase-js";
/**
 * Supabase Integration Scaffold
 *
 * This module will handle database operations for:
 *   - Transaction records
 *   - Proof of Payment storage
 *   - User preferences
 *   - Route caching and analytics
 *
 * Dependencies to install when ready:
 *   pnpm add @supabase/supabase-js
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY (server-side only)
 */

// ─── Types ───────────────────────────────────────────────────
export interface TransactionRecord {
  id: string;
  walletAddress: string;
  originCountry: string;
  destinationCountry: string;
  originAmount: number;
  originCurrency: string;
  destinationAmount: number;
  destinationCurrency: string;
  feeAmount: number;
  stellarTxHash: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
  completedAt: string | null;
}

export interface ProofRecord {
  id: string;
  transactionId: string;
  stellarTxHash: string;
  proofData: Record<string, unknown>;
  createdAt: string;
}


// ─── Client factory ──────────────────────────────────────────

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, key);
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, key);
}

// ─── Placeholder functions ───────────────────────────────────

/**
 * Save a transaction record.
 * TODO: Insert into `transactions` table.
 */
export async function saveTransaction(
  record: TransactionRecord
): Promise<{ success: boolean }> {
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("remittances")
    .insert([
      {
        sender_wallet: record.walletAddress,
        origin_country: record.originCountry,
        destination_country: record.destinationCountry,
        amount: record.originAmount,
        stellar_tx_hash: record.stellarTxHash,
        status: record.status,
      },
    ]);

  if (error) {
    console.error(error);
    return { success: false };
  }

  return { success: true };
}


/**
 * Get transaction by ID.
 * TODO: Query `transactions` table.
 */
export async function getTransaction(
  _id: string
): Promise<TransactionRecord | null> {
  return null;
}

/**
 * Save a proof of payment.
 * TODO: Insert into `proofs` table.
 */
export async function saveProof(
  _proof: ProofRecord
): Promise<{ success: boolean }> {
  return { success: true };
}

/**
 * Get all transactions for a wallet address.
 * TODO: Query `transactions` table with RLS.
 */
export async function getTransactionsByWallet(
  _walletAddress: string
): Promise<TransactionRecord[]> {
  return [];
}
