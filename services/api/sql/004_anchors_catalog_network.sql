alter table if exists public.anchors_catalog
  add column if not exists network text not null default 'mainnet'
  check (network in ('mainnet', 'testnet'));

create index if not exists anchors_catalog_network_idx
  on public.anchors_catalog (network);
