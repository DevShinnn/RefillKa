// Creates a sandbox LGU, two demo logins, and sample stores.
// Scoped by RLS to "Demo sandbox" so testers cannot edit Taguig data.
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* env may come from the shell */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const DEMO_LGU = 'Demo sandbox';
const PIN = '203047';
const ACCOUNTS = [
  { officerId: 'DEMO01', name: 'Demo CENRO', role: 'cenro' },
  { officerId: 'DEMOADM', name: 'Demo LGU Admin', role: 'lgu_admin' },
];

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function runPsql(db, sql) {
  const tries = ['psql', 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe'];
  for (const bin of tries) {
    const psql = spawnSync(bin, [db, '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' });
    if (psql.error && psql.error.code === 'ENOENT') continue;
    return psql;
  }
  return { status: 1, stderr: 'psql not found' };
}

function loginEmail(officerId) {
  return `${officerId.toLowerCase()}@id.refillka.local`;
}

async function findUserByEmail(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function writeProfile(userId, { name, role, officerId, lguId }) {
  const row = {
    id: userId,
    full_name: name,
    role,
    officer_id: officerId,
    lgu_id: lguId,
    region_id: null,
  };
  const db = process.env.DATABASE_URL;
  if (db) {
    const sql = `
      set session_replication_role = replica;
      insert into public.profiles (id, full_name, role, officer_id, lgu_id, region_id)
      values ('${userId}'::uuid, '${name.replace(/'/g, "''")}', '${role}', '${officerId}', '${lguId}'::uuid, null)
      on conflict (id) do update set
        full_name = excluded.full_name,
        role = excluded.role,
        officer_id = excluded.officer_id,
        lgu_id = excluded.lgu_id,
        region_id = excluded.region_id;
      set session_replication_role = origin;
    `;
    const psql = runPsql(db, sql);
    if (psql.status !== 0) {
      const { error } = await admin.from('profiles').upsert(row);
      if (error) throw new Error(psql.stderr || error.message);
    }
    return;
  }
  const { error } = await admin.from('profiles').upsert(row);
  if (error) throw error;
}

async function ensureAccount(account, lguId) {
  const email = loginEmail(account.officerId);
  const meta = {
    full_name: account.name,
    role: account.role,
    officer_id: account.officerId,
    lgu_id: lguId,
  };
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PIN,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created ${account.officerId}`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: PIN,
      email,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) throw error;
    console.log(`Updated ${account.officerId}`);
  }
  await writeProfile(user.id, { ...account, lguId });
  return user;
}

function addDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00+08:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fridayWeekStart(ymd) {
  const d = new Date(`${ymd}T00:00:00+08:00`);
  const offset = (d.getDay() - 5 + 7) % 7;
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { data: region, error: regionErr } = await admin.from('regions').select('id').eq('code', 'NCR').maybeSingle();
  if (regionErr || !region?.id) {
    console.error('Could not find NCR. Apply seed_reference.sql first.');
    process.exit(1);
  }

  let { data: lgu } = await admin.from('lgus').select('id').eq('name', DEMO_LGU).maybeSingle();
  if (!lgu?.id) {
    const { data: created, error } = await admin
      .from('lgus')
      .insert({ region_id: region.id, name: DEMO_LGU, kind: 'City' })
      .select('id')
      .single();
    if (error || !created?.id) {
      console.error(error?.message || 'Could not create Demo sandbox LGU');
      process.exit(1);
    }
    lgu = created;
    console.log('Created Demo sandbox LGU');
  } else {
    console.log('Demo sandbox LGU already exists');
  }

  const field = await ensureAccount(ACCOUNTS[0], lgu.id);
  await ensureAccount(ACCOUNTS[1], lgu.id);

  const claimed = addDays(new Date().toISOString().slice(0, 10), -28);
  const samples = [
    {
      store_code: 'DEMO-01',
      arrp_id: 'ARRP-D001',
      name: 'DEMO — Aling Rosa',
      first_name: 'Rosa',
      last_name: 'Santos',
      barangay: 'Demo Village',
      city: 'Demo City',
      phone: '09170000001',
      pay_plan: 'installment',
      claimed_on: claimed,
      classification: 'sari_sari',
      channel: 'Sari-sari',
    },
    {
      store_code: 'DEMO-02',
      arrp_id: 'ARRP-D002',
      name: 'DEMO — Mang Tony',
      first_name: 'Antonio',
      last_name: 'Reyes',
      barangay: 'Demo Village',
      city: 'Demo City',
      phone: '09170000002',
      pay_plan: 'installment',
      claimed_on: addDays(claimed, 14),
      classification: 'sari_sari',
      channel: 'Sari-sari',
    },
    {
      store_code: 'DEMO-03',
      arrp_id: 'ARRP-D003',
      name: 'DEMO — Paid Hub',
      first_name: 'Liza',
      last_name: 'Cruz',
      barangay: 'Demo Centro',
      city: 'Demo City',
      phone: '09170000003',
      pay_plan: 'fully_paid',
      claimed_on: claimed,
      classification: 'independent_reseller',
      channel: 'Independent reseller',
    },
  ];

  const stores = [];
  for (const sample of samples) {
    const { data: existing } = await admin.from('stores').select('id').eq('store_code', sample.store_code).maybeSingle();
    if (existing?.id) {
      stores.push(existing);
      continue;
    }
    const { data, error } = await admin
      .from('stores')
      .insert({
        lgu_id: lgu.id,
        active: true,
        updated_by: field.id,
        updated_by_name: 'Demo CENRO',
        ...sample,
      })
      .select('id')
      .single();
    if (error || !data) {
      console.error(error?.message || `Could not add ${sample.name}`);
      process.exit(1);
    }
    stores.push(data);
    console.log(`Added ${sample.name}`);
  }

  const firstStore = stores[0];
  if (firstStore?.id) {
    const { count } = await admin.from('payments').select('id', { count: 'exact', head: true }).eq('store_id', firstStore.id);
    if (!count) {
      const paidOn = addDays(claimed, 10);
      const { error } = await admin.from('payments').insert({
        store_id: firstStore.id,
        amount: 550,
        paid_on: paidOn,
        week_start: fridayWeekStart(addDays(claimed, 7)),
        notes: 'Demo kit collection',
        logged_by: field.id,
      });
      if (error) console.error(`Payment seed skipped: ${error.message}`);
      else console.log('Added a demo kit collection on Aling Rosa');
    }
  }

  console.log('\nSandbox only — these logins cannot see Taguig stores.\n');
  console.log(`  Field  /login   ID ${ACCOUNTS[0].officerId}   PIN ${PIN}`);
  console.log(`  Admin  /ops     ID ${ACCOUNTS[1].officerId}   PIN ${PIN}`);
  console.log('');
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
