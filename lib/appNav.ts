export type FieldTab = 'stores' | 'reorders' | 'feedback' | 'report';
export type FieldScreen = 'list' | 'new' | 'store';
export type OpsTab =
  | 'overview'
  | 'users'
  | 'stores'
  | 'inventory'
  | 'collections'
  | 'reorders'
  | 'feedback'
  | 'report'
  | 'database';

const FIELD_TABS: FieldTab[] = ['stores', 'reorders', 'feedback', 'report'];
const OPS_TABS: OpsTab[] = [
  'overview',
  'users',
  'stores',
  'inventory',
  'collections',
  'reorders',
  'feedback',
  'report',
  'database',
];

export function logHref(input: { tab?: FieldTab; store?: string | null; newStore?: boolean } = {}) {
  const q = new URLSearchParams();
  if (input.newStore) q.set('new', '1');
  else if (input.store) q.set('store', input.store);
  else if (input.tab && input.tab !== 'stores') q.set('tab', input.tab);
  const search = q.toString();
  return search ? `/log?${search}` : '/log';
}

export function parseLogSearch(search: URLSearchParams): { tab: FieldTab; screen: FieldScreen; storeId: string | null } {
  if (search.get('new') === '1') return { tab: 'stores', screen: 'new', storeId: null };
  const storeId = search.get('store');
  if (storeId) return { tab: 'stores', screen: 'store', storeId };
  const tab = search.get('tab');
  if (tab && (FIELD_TABS as string[]).includes(tab)) {
    return { tab: tab as FieldTab, screen: 'list', storeId: null };
  }
  return { tab: 'stores', screen: 'list', storeId: null };
}

export function opsHref(tab: OpsTab = 'overview') {
  return tab === 'overview' ? '/ops' : `/ops?tab=${tab}`;
}

export function parseOpsTab(search: URLSearchParams): OpsTab {
  const tab = search.get('tab');
  return tab && (OPS_TABS as string[]).includes(tab) ? (tab as OpsTab) : 'overview';
}
