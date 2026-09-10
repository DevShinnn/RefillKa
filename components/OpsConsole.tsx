'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { persistStore } from '@/app/ops/actions';
import { opsHref, parseOpsTab } from '@/lib/appNav';
import { mergeScopedRows, splitLiveData } from '@/lib/demo';
import { createClient } from '@/lib/supabase/client';
import { useCollections } from '@/lib/hooks/useCollections';
import { usePayments } from '@/lib/hooks/usePayments';
import { useAllStoreFeedback } from '@/lib/hooks/useAllStoreFeedback';
import { useAppFeedback } from '@/lib/hooks/useAppFeedback';
import { repliesFor, useFeedbackReplies } from '@/lib/hooks/useFeedbackReplies';
import { manilaYmd } from '@/lib/format';
import { isInstallmentStore, isInstallmentTag, storesDueForFullyPaid } from '@/lib/installments';
import { isPendingOrder, withDelivered } from '@/lib/orders';
import { ROLE_LABEL } from '@/lib/roles';
import { classificationLabel, payPlanLabel, storeDisplayName } from '@/lib/storeProfile';
import type {
  AppFeedback,
  Collection,
  FeedbackReply,
  Lgu,
  Payment,
  Product,
  Profile,
  Region,
  Store,
  StoreFeedback,
} from '@/lib/types';
import { Topbar } from './Topbar';
import { OpsSidebar, type OpsTab } from './OpsSidebar';
import { OpsUsersPanel } from './OpsUsersPanel';
import { OpsStoresPanel } from './OpsStoresPanel';
import { OpsInventoryPanel } from './OpsInventoryPanel';
import { OpsDatabasePanel } from './OpsDatabasePanel';
import { OpsFeedbackPanel } from './OpsFeedbackPanel';
import { OpsCollectionsPanel } from './OpsCollectionsPanel';
import { ReordersPanel } from './ReordersPanel';
import { ReportPanel } from './ReportPanel';
import { Empty, toast } from './ui';

const TITLES: Record<OpsTab, string> = {
  overview: 'Overview',
  users: 'Accounts',
  stores: 'Stores',
  inventory: 'Inventory',
  collections: 'Collections',
  reorders: 'Reorders',
  feedback: 'Feedback',
  report: 'Report',
  database: 'Database',
};

export function OpsConsole({
  profile,
  scope,
  stores: initialStores,
  payments,
  orders,
  accounts: initialAccounts,
  products: initialProducts,
  lgus,
  regions,
  storeNotes: initialStoreNotes,
  appNotes: initialAppNotes,
  replies: initialReplies,
}: {
  profile: Profile;
  scope: string;
  stores: Store[];
  payments: Payment[];
  orders: Collection[];
  accounts: Profile[];
  products: Product[];
  lgus: Lgu[];
  regions: Region[];
  storeNotes: StoreFeedback[];
  appNotes: AppFeedback[];
  replies: FeedbackReply[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const { rows: liveOrders, setRows: setOrderRows } = useCollections(orders);
  const { rows: livePays, setRows: setPayRows } = usePayments(payments);
  const { rows: liveStoreNotes } = useAllStoreFeedback(initialStoreNotes);
  const { rows: liveAppNotes } = useAppFeedback(initialAppNotes);
  const { rows: liveReplies, setRows: setReplies } = useFeedbackReplies(initialReplies);
  const [storeState, setStores] = useState(initialStores);
  const [accountState, setAccounts] = useState(initialAccounts);
  const scoped = useMemo(
    () =>
      splitLiveData(profile, {
        stores: storeState,
        accounts: accountState,
        lgus,
        payments: livePays,
        orders: liveOrders,
        storeNotes: liveStoreNotes,
        appNotes: liveAppNotes,
        replies: liveReplies,
      }),
    [profile, storeState, accountState, lgus, livePays, liveOrders, liveStoreNotes, liveAppNotes, liveReplies]
  );
  const stores = scoped.stores;
  const accounts = scoped.accounts;
  const orderRows = scoped.orders;
  const payRows = scoped.payments;
  const storeNotes = scoped.storeNotes;
  const appNotes = scoped.appNotes;
  const replies = scoped.replies;
  const visibleLgus = scoped.lgus;

  const replaceStores = (next: Store[]) =>
    setStores((prev) =>
      mergeScopedRows(prev, next, splitLiveData(profile, { stores: prev, lgus }).stores.map((row) => row.id))
    );
  const replaceAccounts = (next: Profile[]) =>
    setAccounts((prev) =>
      mergeScopedRows(prev, next, splitLiveData(profile, { accounts: prev }).accounts.map((row) => row.id))
    );
  const replacePayments = (next: Payment[]) =>
    setPayRows((prev) =>
      mergeScopedRows(
        prev,
        next,
        splitLiveData(profile, { stores: storeState, lgus, payments: prev }).payments.map((row) => row.id)
      )
    );
  const replaceOrders = (next: Collection[]) =>
    setOrderRows((prev) =>
      mergeScopedRows(
        prev,
        next,
        splitLiveData(profile, { stores: storeState, lgus, orders: prev }).orders.map((row) => row.id)
      )
    );
  const [products, setProducts] = useState(initialProducts);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseOpsTab(searchParams);
  const [navOpen, setNavOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storeFocus, setStoreFocus] = useState<string | null>(null);

  const pendingOrders = orderRows.filter(isPendingOrder);
  const installment = stores.filter((s) => isInstallmentStore(s, payRows)).length;
  const stillPaying = stores.filter((s) => isInstallmentStore(s, payRows)).length;
  const cenroNotes = appNotes.filter((r) => r.logged_by_role === 'cenro');
  const unrepliedFeedback =
    storeNotes.filter((r) => repliesFor(replies, 'store', r.id).length === 0).length +
    cenroNotes.filter((r) => repliesFor(replies, 'app', r.id).length === 0).length;

  const issues = useMemo(() => {
    const rows: { id: string; store: string; note: string }[] = [];
    for (const s of stores) {
      const label = storeDisplayName(s);
      if (!s.store_code || !s.arrp_id) rows.push({ id: s.id, store: label, note: 'Missing RK / ARRP ID' });
      if (!s.first_name?.trim() || !s.last_name?.trim()) rows.push({ id: s.id, store: label, note: 'Missing first or last name' });
      if (!s.phone?.trim()) rows.push({ id: s.id, store: label, note: 'No contact number' });
      if (isInstallmentStore(s) && !s.claimed_on) rows.push({ id: s.id, store: label, note: 'Installment with no claim date' });
    }
    return rows;
  }, [stores]);

  useEffect(() => {
    const due = storesDueForFullyPaid(stores, payRows);
    if (!due.length) return;
    let cancelled = false;
    void (async () => {
      const saved = new Map<string, Store>();
      for (const s of due) {
        const result = await persistStore({ id: s.id, lguId: s.lgu_id, patch: { pay_plan: 'fully_paid' } });
        if (result.store) saved.set(result.store.id, result.store);
      }
      if (cancelled || !saved.size) return;
      setStores((prev) => prev.map((s) => saved.get(s.id) ?? s));
    })();
    return () => {
      cancelled = true;
    };
  }, [payRows, stores, supabase]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 960px)');
    const sync = () => setNavOpen(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 959px)').matches;
    document.body.style.overflow = navOpen && mobile ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [navOpen]);

  const go = (next: OpsTab, storeId?: string) => {
    if (storeId) setStoreFocus(storeId);
    router.push(opsHref(next));
    if (window.matchMedia('(max-width: 959px)').matches) setNavOpen(false);
  };

  const markDelivered = async (order: Collection) => {
    setBusy(true);
    const notes = withDelivered(order.notes, manilaYmd());
    const { data, error } = await supabase.from('collections').update({ notes }).eq('id', order.id).select('*').single();
    setBusy(false);
    if (error || !data) return toast(error?.message || 'Could not tag delivered');
    setOrderRows((prev) => prev.map((r) => (r.id === data.id ? (data as Collection) : r)));
    toast('Tagged delivered');
  };

  const deleteOrder = async (order: Collection) => {
    setBusy(true);
    const { error } = await supabase.from('collections').delete().eq('id', order.id);
    setBusy(false);
    if (error) return toast(error.message || 'Could not delete reorder');
    setOrderRows((prev) => prev.filter((r) => r.id !== order.id));
    toast('Reorder deleted');
  };

  return (
    <div className={`app app--ops${navOpen ? ' is-nav' : ''}`}>
      {navOpen ? (
        <button className="sidebar__scrim no-print" type="button" aria-label="Close menu" onClick={() => setNavOpen(false)} />
      ) : null}
      <OpsSidebar
        open={navOpen}
        tab={tab}
        collectionCount={stillPaying}
        reorderCount={pendingOrders.length}
        feedbackCount={unrepliedFeedback}
        onGo={(next) => go(next)}
        onToggle={() => setNavOpen((open) => !open)}
      />
      <div className="app__body">
        <Topbar
          role={profile.role}
          name={profile.full_name || 'Developer'}
          meta={scope}
          officerId={profile.officer_id}
          heading={TITLES[tab]}
          onMenu={() => setNavOpen((open) => !open)}
          menuOpen={navOpen}
        />
        <main className="main">
          {tab === 'overview' && (
            <>
              <header className="pagehead">
                <p className="kicker">{profile.officer_id} · {scope}</p>
                <h1>Operations</h1>
                <p className="sub">Create accounts, assign access, add stores, and track kit collections, refill orders, and reports from this desktop console.</p>
              </header>
              <div className="crm-stats ops-stats">
                <button type="button" className="crm-stat" onClick={() => go('stores')}>
                  <strong>{stores.length}</strong>
                  <span>Stores</span>
                </button>
                <button type="button" className="crm-stat" onClick={() => go('collections')}>
                  <strong>{stillPaying}</strong>
                  <span>Kit collections</span>
                </button>
                <button type="button" className="crm-stat" onClick={() => go('reorders')}>
                  <strong>{pendingOrders.length}</strong>
                  <span>Pending refills</span>
                </button>
                <button type="button" className="crm-stat" onClick={() => go('stores')}>
                  <strong>{issues.length}</strong>
                  <span>Fixes needed</span>
                </button>
              </div>
              <div className="ops-dash">
                <section className="sheet">
                  <header className="sheet__h">
                    <h3>Needs a look</h3>
                    <p className="sub">{issues.length ? 'Open the store and finish the missing fields.' : 'Store records look complete.'}</p>
                  </header>
                  {issues.length ? (
                    <ul className="issue-list">
                      {issues.slice(0, 16).map((row, i) => (
                        <li key={`${row.id}-${i}`}>
                          <button type="button" onClick={() => go('stores', row.id)}>
                            <strong>{row.store}</strong>
                            <span>{row.note}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty msg="Nothing waiting on a fix." />
                  )}
                    <p className="pricehint">{installment} installment · {stores.length - installment} fully paid · {payRows.filter(isInstallmentTag).length} kit tags</p>
                </section>
                <section className="sheet">
                  <header className="sheet__h">
                    <h3>Recent accounts</h3>
                    <p className="sub">Create logins, assign roles, and reset PINs in Accounts.</p>
                  </header>
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.slice(0, 8).map((a) => (
                          <tr key={a.id} onClick={() => go('users')}>
                            <td>{a.officer_id || '—'}</td>
                            <td>{a.full_name || '—'}</td>
                            <td>{ROLE_LABEL[a.role] || a.role}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="pricehint">
                    {stores.filter((s) => s.classification === 'independent_reseller').length
                      ? `${stores.filter((s) => s.classification === 'independent_reseller').length} independent resellers · `
                      : ''}
                    {classificationLabel('sari_sari')} / {payPlanLabel('installment')} are the field defaults.
                  </p>
                </section>
              </div>
            </>
          )}

          {tab === 'users' && (
            <OpsUsersPanel
              me={profile}
              accounts={accounts}
              lgus={visibleLgus}
              regions={regions}
              busy={busy}
              setBusy={setBusy}
              onChange={replaceAccounts}
            />
          )}

          {tab === 'stores' && (
            <OpsStoresPanel
              profile={profile}
              stores={stores}
              lgus={visibleLgus}
              busy={busy}
              setBusy={setBusy}
              onChange={replaceStores}
              focusId={storeFocus}
              orders={orderRows}
              payments={payRows}
            />
          )}

          {tab === 'inventory' && (
            <OpsInventoryPanel products={products} busy={busy} setBusy={setBusy} onChange={setProducts} orders={orderRows} />
          )}

          {tab === 'collections' && (
            <OpsCollectionsPanel
              stores={stores}
              payments={payRows}
              onOpenStore={(store) => go('stores', store.id)}
            />
          )}

          {tab === 'reorders' && (
            <ReordersPanel
              stores={stores}
              products={products}
              orders={orderRows}
              payments={payRows}
              busy={busy}
              onOpenStore={(store) => go('stores', store.id)}
              onMarkDelivered={markDelivered}
              onDelete={deleteOrder}
            />
          )}

          {tab === 'feedback' && (
            <OpsFeedbackPanel
              profile={profile}
              stores={stores}
              storeNotes={storeNotes}
              cenroNotes={cenroNotes}
              replies={replies}
              setReplies={setReplies}
              busy={busy}
              setBusy={setBusy}
            />
          )}

          {tab === 'report' && (
            <ReportPanel
              stores={stores}
              products={products}
              orders={orderRows}
              payments={payRows}
              officer={profile.full_name || 'Developer'}
              officerId={profile.officer_id}
              scope={scope}
            />
          )}

          {tab === 'database' && (
            <OpsDatabasePanel
              profile={profile}
              stores={stores}
              payments={payRows}
              orders={orderRows}
              accounts={accounts}
              products={products}
              lgus={visibleLgus}
              regions={regions}
              busy={busy}
              setBusy={setBusy}
              onStores={replaceStores}
              onPayments={replacePayments}
              onOrders={replaceOrders}
              onAccounts={replaceAccounts}
              onProducts={setProducts}
            />
          )}
        </main>
      </div>
    </div>
  );
}
