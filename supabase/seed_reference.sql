-- ============================================================
--  RefillKa — reference data seed (regions, sample LGUs, stores)
--  Run AFTER 0001_init.sql. Idempotent.
--  National admins can add more LGUs/stores from the app later.
-- ============================================================

-- All 17 Philippine regions
insert into public.regions (code, name) values
  ('NCR',   'National Capital Region'),
  ('CAR',   'Cordillera Administrative Region'),
  ('R1',    'Ilocos Region'),
  ('R2',    'Cagayan Valley'),
  ('R3',    'Central Luzon'),
  ('R4A',   'CALABARZON'),
  ('R4B',   'MIMAROPA'),
  ('R5',    'Bicol Region'),
  ('R6',    'Western Visayas'),
  ('R7',    'Central Visayas'),
  ('R8',    'Eastern Visayas'),
  ('R9',    'Zamboanga Peninsula'),
  ('R10',   'Northern Mindanao'),
  ('R11',   'Davao Region'),
  ('R12',   'SOCCSKSARGEN'),
  ('R13',   'Caraga'),
  ('BARMM', 'Bangsamoro (BARMM)')
on conflict (code) do nothing;

-- A few sample LGUs (the pilot runs in Taguig; others show nationwide scoping)
insert into public.lgus (region_id, name, kind)
select r.id, v.name, v.kind
from (values
  ('NCR', 'Taguig',      'City'),
  ('NCR', 'Makati',      'City'),
  ('NCR', 'Quezon City', 'City'),
  ('R7',  'Cebu City',   'City'),
  ('R11', 'Davao City',  'City')
) as v(region_code, name, kind)
join public.regions r on r.code = v.region_code
on conflict (region_id, name) do nothing;

-- Pilot stores under Taguig
insert into public.stores (lgu_id, name, barangay, channel)
select l.id, v.name, v.barangay, v.channel
from (values
  ('RefillKa Hub — Ususan',            'Ususan',          'Hub'),
  ('Sari-Sari Refill — Bagumbayan',    'Bagumbayan',      'Sari-sari'),
  ('Palengke Refill Station — Signal', 'Signal Village',  'Palengke'),
  ('NutriAsia Refill Point — Central', 'Central Bicutan', 'Anchor'),
  ('Sari-Sari Refill — W. Bicutan',    'Western Bicutan', 'Sari-sari')
) as v(name, barangay, channel)
join public.lgus l on l.name = 'Taguig'
where not exists (select 1 from public.stores s where s.name = v.name);
