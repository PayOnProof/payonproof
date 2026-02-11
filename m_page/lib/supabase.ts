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

/**
 * Create a Supabase client for server-side operations.
 * TODO: Implement using createClient from @supabase/supabase-js.
 */
export function createSupabaseServerClient() {
  const _url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const _key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Placeholder: return null until Supabase is connected
  return null;
}

/**
 * Create a Supabase client for client-side operations (anon key).
 * TODO: Implement using createBrowserClient from @supabase/ssr.
 */
export function createSupabaseBrowserClient() {
  const _url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const _key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Placeholder: return null until Supabase is connected
  return null;
}

// ─── Placeholder functions ───────────────────────────────────

/**
 * Save a transaction record.
 * TODO: Insert into `transactions` table.
 */
export async function saveTransaction(
  _record: TransactionRecord
): Promise<{ success: boolean }> {
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
