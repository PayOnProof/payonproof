alter table if exists public.anchors_catalog
  add column if not exists sep24 boolean not null default false,
  add column if not exists sep6 boolean not null default false,
  add column if not exists sep31 boolean not null default false,
  add column if not exists sep10 boolean not null default false,
  add column if not exists operational boolean not null default false,
  add column if not exists fee_fixed numeric,
  add column if not exists fee_percent numeric,
  add column if not exists fee_source text not null default 'default',
  add column if not exists transfer_server_sep24 text,
  add column if not exists transfer_server_sep6 text,
  add column if not exists web_auth_endpoint text,
  add column if not exists direct_payment_server text,
  add column if not exists kyc_server text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists diagnostics jsonb not null default '[]'::jsonb;

create index if not exists anchors_catalog_operational_idx
  on public.anchors_catalog (operational);

create index if not exists anchors_catalog_last_checked_idx
  on public.anchors_catalog (last_checked_at);
