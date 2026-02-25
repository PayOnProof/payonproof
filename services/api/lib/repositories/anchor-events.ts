import { getSupabaseAdmin } from "../supabase.ts";

export interface AnchorCallbackEvent {
  transactionId: string;
  callbackToken: string;
  status?: string;
  stellarTxHash?: string;
  externalTransactionId?: string;
  sourceAnchor?: string;
  raw?: unknown;
  receivedAt: string;
}

const memoryStore = new Map<string, AnchorCallbackEvent>();

function memoryKey(transactionId: string, callbackToken: string): string {
  return `${transactionId}::${callbackToken}`;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function upsertToSupabase(event: AnchorCallbackEvent): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("anchor_callback_events").upsert(
    {
      transaction_id: event.transactionId,
      callback_token: event.callbackToken,
      status: event.status ?? null,
      stellar_tx_hash: event.stellarTxHash ?? null,
      external_transaction_id: event.externalTransactionId ?? null,
      source_anchor: event.sourceAnchor ?? null,
      raw_payload: asObject(event.raw),
      received_at: event.receivedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "transaction_id,callback_token" }
  );
  if (error) {
    throw new Error(`anchor_callback_events upsert failed: ${error.message}`);
  }
}

async function loadFromSupabase(input: {
  transactionId: string;
  callbackToken: string;
}): Promise<AnchorCallbackEvent | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("anchor_callback_events")
    .select(
      "transaction_id,callback_token,status,stellar_tx_hash,external_transaction_id,source_anchor,raw_payload,received_at"
    )
    .eq("transaction_id", input.transactionId)
    .eq("callback_token", input.callbackToken)
    .maybeSingle();
  if (error) {
    throw new Error(`anchor_callback_events query failed: ${error.message}`);
  }
  if (!data) return null;
  return {
    transactionId: String(data.transaction_id),
    callbackToken: String(data.callback_token),
    status: data.status ? String(data.status) : undefined,
    stellarTxHash: data.stellar_tx_hash ? String(data.stellar_tx_hash) : undefined,
    externalTransactionId: data.external_transaction_id
      ? String(data.external_transaction_id)
      : undefined,
    sourceAnchor: data.source_anchor ? String(data.source_anchor) : undefined,
    raw: data.raw_payload,
    receivedAt: data.received_at ? String(data.received_at) : new Date().toISOString(),
  };
}

export async function upsertAnchorCallbackEvent(event: AnchorCallbackEvent): Promise<void> {
  memoryStore.set(memoryKey(event.transactionId, event.callbackToken), event);
  try {
    await upsertToSupabase(event);
  } catch {
    // Keep in-memory fallback for local dev or missing table.
  }
}

export async function getAnchorCallbackEvent(input: {
  transactionId: string;
  callbackToken: string;
}): Promise<AnchorCallbackEvent | null> {
  const fromMemory = memoryStore.get(memoryKey(input.transactionId, input.callbackToken));
  if (fromMemory) return fromMemory;

  try {
    const fromDb = await loadFromSupabase(input);
    if (fromDb) {
      memoryStore.set(memoryKey(input.transactionId, input.callbackToken), fromDb);
      return fromDb;
    }
  } catch {
    // ignore and return null
  }

  return null;
}
