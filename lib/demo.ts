/** Sandbox LGU + shared demo PIN. Testers never get superadmin. */
export const DEMO_LGU_NAME = 'Demo sandbox';
export const DEMO_PIN = '203047';

export const DEMO_FIELD = {
  officerId: 'DEMO01',
  name: 'Demo CENRO',
  role: 'cenro' as const,
};

export const DEMO_OPS = {
  officerId: 'DEMOADM',
  name: 'Demo LGU Admin',
  role: 'lgu_admin' as const,
};

export function isDemoStore(store: { store_code?: string | null; arrp_id?: string | null; name?: string | null }) {
  const code = (store.store_code || '').toUpperCase();
  const arrp = (store.arrp_id || '').toUpperCase();
  const name = (store.name || '').toUpperCase();
  return code.startsWith('DEMO-') || arrp.startsWith('ARRP-D') || name.startsWith('DEMO');
}

export function isDemoOfficer(officerId?: string | null) {
  return /^DEMO/i.test(officerId || '');
}

export function withoutDemoStores<T extends { store_code?: string | null; arrp_id?: string | null; name?: string | null; id: string }>(stores: T[]): T[] {
  return stores.filter((store) => !isDemoStore(store));
}

export function withoutDemoRows<T extends { store_id: string }>(rows: T[], stores: { id: string; store_code?: string | null; arrp_id?: string | null; name?: string | null }[]): T[] {
  const demoIds = new Set(stores.filter(isDemoStore).map((store) => store.id));
  return rows.filter((row) => !demoIds.has(row.store_id));
}
