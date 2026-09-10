// ============================================================
//  RefillKa — seed pre-pilot test accounts (nationwide roles)
//
//  Prereq: run 0001_init.sql and seed_reference.sql first, then set
//  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
//
//  Usage:  npm run seed:users     (safe to re-run — existing users skipped)
// ============================================================
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// tiny .env.local loader (no dependency)
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* env may come from the shell */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const PASSWORD = 'RefillKa2030!'; // shared pre-pilot test password — change before real pilot

const PILOT_LGU = 'Taguig';
const PILOT_REGION = 'NCR';

async function ensureUser({ email, role, name, region_id, lgu_id }) {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      role,
      ...(region_id ? { region_id } : {}),
      ...(lgu_id ? { lgu_id } : {}),
    },
  });
  if (error) {
    if (/already/i.test(error.message)) { console.log(`•  exists   ${email}`); return; }
    console.error(`✗  ${email}: ${error.message}`); return;
  }
  console.log(`✓  created  ${email}  (${role})`);
}

async function main() {
  const [{ data: regions, error: rErr }, { data: lgus }] = await Promise.all([
    admin.from('regions').select('id,code'),
    admin.from('lgus').select('id,name'),
  ]);
  if (rErr || !regions?.length) {
    console.error('✗ Could not read reference data — run 0001_init.sql and seed_reference.sql first.');
    process.exit(1);
  }
  const regionId = Object.fromEntries(regions.map((r) => [r.code, r.id]));
  const lguId = Object.fromEntries((lgus || []).map((l) => [l.name, l.id]));

  const NCR = regionId[PILOT_REGION];
  const TAGUIG = lguId[PILOT_LGU];

  console.log('Seeding RefillKa pre-pilot accounts…\n');

  // Platform (developer) — full control of everything
  await ensureUser({ email: 'dev@refillka.test', role: 'superadmin', name: 'Platform Developer' });

  // National (HQ) — no scope
  await ensureUser({ email: 'admin@refillka.test', role: 'national_admin', name: 'National Admin (HQ)' });
  await ensureUser({ email: 'ceo@refillka.test',   role: 'national_exec',  name: 'CEO — ReCirca' });

  // Regional (NCR)
  await ensureUser({ email: 'ncr.director@refillka.test', role: 'regional_exec', name: 'NCR Regional Director', region_id: NCR });

  // Taguig LGU
  await ensureUser({ email: 'taguig.admin@refillka.test', role: 'lgu_admin', name: 'Taguig LGU Admin',    lgu_id: TAGUIG });
  await ensureUser({ email: 'mayor.taguig@refillka.test', role: 'lgu_exec',  name: 'Office of the Mayor', lgu_id: TAGUIG });
  await ensureUser({ email: 'cenro.santos@refillka.test',   role: 'cenro', name: 'Ofc. J. Santos',    lgu_id: TAGUIG });
  await ensureUser({ email: 'cenro.reyes@refillka.test',    role: 'cenro', name: 'Ofc. M. Reyes',     lgu_id: TAGUIG });
  await ensureUser({ email: 'cenro.delacruz@refillka.test', role: 'cenro', name: 'Ofc. A. dela Cruz', lgu_id: TAGUIG });

  console.log(`\nDone. All accounts use password:  ${PASSWORD}`);
  console.log('Change this before any real pilot.\n');
}
main();
