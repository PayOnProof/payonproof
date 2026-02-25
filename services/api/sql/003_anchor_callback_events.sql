create table if not exists public.anchor_callback_events (
  transaction_id text not null,
  callback_token text not null,
  status text,
  stellar_tx_hash text,
  external_transaction_id text,
  source_anchor text,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (transaction_id, callback_token)
);

create index if not exists idx_anchor_callback_events_tx_hash
  on public.anchor_callback_events (stellar_tx_hash);
