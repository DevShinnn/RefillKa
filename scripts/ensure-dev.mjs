// Create or repair the developer login (DEV01). Does not seed @refillka.test users.
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

const EMAIL = 'dev01@id.refillka.local';
const OFFICER_ID = 'DEV01';
const PIN = '203010';
const NAME = 'Developer';

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

async function main() {
  const { data: lgu, error: lguErr } = await admin.from('lgus').select('id').eq('name', 'Taguig').maybeSingle();
  if (lguErr || !lgu?.id) {
    console.error('Could not find Taguig LGU. Apply seed_reference.sql first.');
    process.exit(1);
  }

  const meta = {
    full_name: NAME,
    role: 'superadmin',
    officer_id: OFFICER_ID,
    lgu_id: lgu.id,
  };

  let user = await findUserByEmail(EMAIL);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PIN,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    user = data.user;
    console.log(`Created ${OFFICER_ID}`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: PIN,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    console.log(`Updated ${OFFICER_ID}`);
  }

  const db = process.env.DATABASE_URL;
  if (db) {
    const sql = `
      set session_replication_role = replica;
      insert into public.profiles (id, full_name, role, officer_id, lgu_id)
      values ('${user.id}'::uuid, '${NAME}', 'superadmin', '${OFFICER_ID}', '${lgu.id}'::uuid)
      on conflict (id) do update set
        full_name = excluded.full_name,
        role = excluded.role,
        officer_id = excluded.officer_id,
        lgu_id = excluded.lgu_id;
      set session_replication_role = origin;
    `;
    const psql = runPsql(db, sql);
    if (psql.status !== 0) {
      console.error(psql.stderr || 'Could not write developer profile');
      process.exit(1);
    }
  } else {
    const { error: profileErr } = await admin.from('profiles').upsert({
      id: user.id,
      full_name: NAME,
      role: 'superadmin',
      officer_id: OFFICER_ID,
      lgu_id: lgu.id,
      region_id: null,
    });
    if (profileErr) {
      console.error(profileErr.message);
      process.exit(1);
    }
  }

  console.log(`Ops sign-in: /ops  ·  ID ${OFFICER_ID}  ·  PIN ${PIN}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
