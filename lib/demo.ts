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

type Named = { name?: string | null };
type CodedStore = { id: string; lgu_id?: string | null; store_code?: string | null; arrp_id?: string | null; name?: string | null };
type Officer = { officer_id?: string | null; full_name?: string | null; id?: string };

export function isDemoOfficer(officerId?: string | null) {
  return /^DEMO/i.test(officerId || '');
}

export function isDemoViewer(profile?: Officer | null) {
  return isDemoOfficer(profile?.officer_id) || /^demo\b/i.test(profile?.full_name || '');
}

export function isDemoLgu(lgu: Named) {
  return (lgu.name || '').trim() === DEMO_LGU_NAME;
}

export function isDemoStore(store: CodedStore, demoLguIds?: Set<string>) {
  if (store.lgu_id && demoLguIds?.has(store.lgu_id)) return true;
  const code = (store.store_code || '').toUpperCase();
  const arrp = (store.arrp_id || '').toUpperCase();
  const name = (store.name || '').toUpperCase();
  return code.startsWith('DEMO-') || arrp.startsWith('ARRP-D') || name.startsWith('DEMO');
}

export function withoutDemoStores<T extends CodedStore>(stores: T[]): T[] {
  return stores.filter((store) => !isDemoStore(store));
}

export function withoutDemoRows<T extends { store_id: string }>(rows: T[], stores: CodedStore[]): T[] {
  const demoIds = new Set(stores.filter((store) => isDemoStore(store)).map((store) => store.id));
  return rows.filter((row) => !demoIds.has(row.store_id));
}

export function splitLiveData<
  S extends CodedStore,
  A extends Officer & { id: string },
  L extends { id: string; name: string },
  Pay extends { store_id: string },
  Ord extends { store_id: string },
  N extends { store_id: string; id: string },
  F extends { id: string; logged_by: string; logged_by_name?: string | null },
  P extends { id: string; store_feedback_id?: string | null; app_feedback_id?: string | null },
>(
  viewer: Officer | null | undefined,
  input: {
    stores?: S[];
    accounts?: A[];
    lgus?: L[];
    payments?: Pay[];
    orders?: Ord[];
    storeNotes?: N[];
    appNotes?: F[];
    replies?: P[];
  }
) {
  const demo = isDemoViewer(viewer);
  const keep = (isDemo: boolean) => isDemo === demo;
  const demoLguIds = new Set((input.lgus || []).filter(isDemoLgu).map((lgu) => lgu.id));
  const storeDemo = (store: CodedStore) => isDemoStore(store, demoLguIds);
  const stores = (input.stores || []).filter((store) => keep(storeDemo(store)));
  const demoStoreIds = new Set((input.stores || []).filter(storeDemo).map((store) => store.id));
  const accounts = (input.accounts || []).filter((account) => keep(isDemoOfficer(account.officer_id)));
  const demoAccountIds = new Set((input.accounts || []).filter((account) => isDemoOfficer(account.officer_id)).map((account) => account.id));
  const lgus = (input.lgus || []).filter((lgu) => keep(isDemoLgu(lgu)));
  const byStore = <T extends { store_id: string }>(rows: T[] | undefined) =>
    (rows || []).filter((row) => keep(demoStoreIds.has(row.store_id)));
  const storeNotes = byStore(input.storeNotes);
  const appNotes = (input.appNotes || []).filter((note) =>
    keep(demoAccountIds.has(note.logged_by) || /^demo\b/i.test(note.logged_by_name || ''))
  );
  const noteIds = new Set([...storeNotes.map((note) => note.id), ...appNotes.map((note) => note.id)]);
  const replies = (input.replies || []).filter((reply) =>
    noteIds.has(reply.store_feedback_id || '') || noteIds.has(reply.app_feedback_id || '')
  );

  return {
    stores,
    accounts,
    lgus,
    payments: byStore(input.payments),
    orders: byStore(input.orders),
    storeNotes,
    appNotes,
    replies,
  };
}

/** Keep the hidden sandbox/live counterpart when a panel saves only the visible rows. */
export function mergeScopedRows<T extends { id: string }>(
  previous: T[],
  nextVisible: T[],
  previousVisibleIds: Iterable<string>
): T[] {
  const wasVisible = new Set(previousVisibleIds);
  const nextIds = new Set(nextVisible.map((row) => row.id));
  return [...previous.filter((row) => !wasVisible.has(row.id) && !nextIds.has(row.id)), ...nextVisible];
}
