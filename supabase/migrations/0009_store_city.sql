-- City on store details (Philippine city / Metro Manila LGU).
-- Barangay stays on stores.barangay and is no longer copied from the street address.

alter table public.stores
  add column if not exists city text not null default 'Taguig';

create index if not exists stores_city_idx on public.stores (city);
