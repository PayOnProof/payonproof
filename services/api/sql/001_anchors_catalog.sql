create table if not exists public.anchors_catalog (
  id text primary key,
  name text not null,
  domain text not null,
  country text not null,
  currency text not null,
  type text not null check (type in ('on-ramp', 'off-ramp')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists anchors_catalog_country_idx
  on public.anchors_catalog (country);

create index if not exists anchors_catalog_type_idx
  on public.anchors_catalog (type);

create index if not exists anchors_catalog_active_idx
  on public.anchors_catalog (active);

-- Seed minimal corridor US -> MX
insert into public.anchors_catalog (id, name, domain, country, currency, type, active)
values
  ('anchor-moneygram-us', 'MoneyGram', 'stellar.moneygram.com', 'US', 'USD', 'on-ramp', true),
  ('anchor-bitso-mx', 'Bitso', 'bitso.com', 'MX', 'MXN', 'off-ramp', true)
on conflict (id) do update
set
  name = excluded.name,
  domain = excluded.domain,
  country = excluded.country,
  currency = excluded.currency,
  type = excluded.type,
  active = excluded.active,
  updated_at = now();
