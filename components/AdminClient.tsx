'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCollections } from '@/lib/hooks/useCollections';
import { usePayments } from '@/lib/hooks/usePayments';
import { MATERIALS, WEEKLY_INSTALLMENT, materialById, productById, type Payment, type Product, type Profile, type Store } from '@/lib/types';
import { fmt, manilaYmd, peso, tstamp, isToday } from '@/lib/format';
import { withoutDemoRows, withoutDemoStores } from '@/lib/demo';
import { INSTALLMENT_WEEKS, installmentWeekFor, planPaidCount } from '@/lib/installments';
import { Topbar } from './Topbar';
import { Kpi, Empty, toast } from './ui';

export function AdminClient({
  profile,
  scope,
  stores: allStores,
  products,
  payments = [],
  initial,
}: {
  profile: Profile;
  scope: string;
  stores: Store[];
  products: Product[];
  payments?: Payment[];
  initial: any[];
}) {
  const stores = withoutDemoStores(allStores);
  const { rows: liveOrders, status, setRows } = useCollections(initial);
  const { rows: livePays } = usePayments(payments);
  const rows = withoutDemoRows(liveOrders, allStores);
  const payRows = withoutDemoRows(livePays, allStores);
  const supabase = useMemo(() => createClient(), []);

  const [fStore, setFStore] = useState('');
  const [fMat, setFMat] = useState('');
  const [fProduct, setFProduct] = useState('');
  const [q, setQ] = useState('');

  const storeById = (id: string) => stores.find((s) => s.id === id);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (fStore && r.store_id !== fStore) return false;
      if (fMat && r.material !== fMat) return false;
      if (fProduct && r.product_id !== fProduct) return false;
      if (query) {
        const s = storeById(r.store_id);
        const p = productById(products, r.product_id);
        const hay = [r.logged_by_name, s?.name, s?.barangay, r.notes, p?.name, materialById(r.material).label]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rows, fStore, fMat, fProduct, q, stores, products]);

  const currentWeek = installmentWeekFor(manilaYmd());
  const collectedWeek = currentWeek
    ? payRows
        .filter((p) => p.week_start === currentWeek.start)
        .reduce((a, p) => a + Number(p.amount), 0)
    : 0;
  const reorders = rows.filter((r) => r.is_reorder).length;
  const willReorder = stores.filter((s) => s.will_reorder).length;

  const del = async (id: string) => {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    setRows((prev) => prev.filter((r) => r.id !== id)); // optimistic
    const { error } = await supabase.from('collections').delete().eq('id', id);
    if (error) toast('Delete failed');
  };

  const exportCSV = () => {
    const head = ['timestamp_iso', 'timestamp_local', 'store', 'barangay', 'channel', 'product', 'price_type', 'reorder', 'quantity', 'unit', 'unit_price', 'line_total', 'logged_by', 'role', 'notes'];
    const body = filtered.map((r) => {
      const s = storeById(r.store_id);
      const p = productById(products, r.product_id);
      const line = r.unit_price != null ? Number(r.unit_price) * Number(r.quantity) : '';
      return [
        r.collected_at,
        tstamp(r.created_at),
        s?.name ?? '',
        s?.barangay ?? '',
        s?.channel ?? '',
        p?.name ?? '',
        r.product_id ? (r.with_container ? 'with container' : 'refill') : '',
        r.is_reorder ? 'yes' : 'no',
        r.quantity,
        r.unit,
        r.unit_price ?? '',
        line,
        r.logged_by_name,
        r.logged_by_role,
        r.notes ?? '',
      ]
        .map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });
    const csv = [head.join(','), ...body].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refillka-collections-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV exported');
  };

  return (
    <div className="app">
      <Topbar role={profile.role} name={profile.full_name || 'Admin'} meta={scope} officerId={profile.officer_id} status={status} />
      <main className="main">
        <div className="viewhead">
          <div>
            <h1>Admin — Sales monitoring</h1>
            <p className="sub">Stores, weekly collections, refills and reorders across the field study.</p>
          </div>
          <button className="btn-sm" onClick={exportCSV}>
            ⭳ Export CSV
          </button>
        </div>

        <div className="kpis">
          <Kpi label="Stores" value={stores.length} unit={`${willReorder} will reorder`} accent="var(--green)" />
          <Kpi label="Collections this week" value={peso(collectedWeek)} unit={`${peso(WEEKLY_INSTALLMENT)} × ${INSTALLMENT_WEEKS} weeks from Sep 11`} accent="var(--blue)" />
          <Kpi label="Refill orders" value={fmt(rows.length)} unit={`${rows.filter((r) => isToday(r.created_at)).length} today`} accent="var(--teal)" />
          <Kpi label="Reorders tagged" value={reorders} unit="repeat product orders" accent="var(--red)" />
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card__h">
            <h3>Store accounts</h3>
            <span className="tag">{stores.length}</span>
          </div>
          <div className="card__b" style={{ padding: '6px 8px' }}>
            <div className="tablewrap">
              {stores.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>Store name</th>
                      <th>Address</th>
                      <th>Number</th>
                      <th>Age</th>
                      <th>Gender</th>
                      <th>Collection {INSTALLMENT_WEEKS} weeks</th>
                      <th>Reorder</th>
                      <th>Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.map((s) => {
                      const paidCount = planPaidCount(payRows, s.id, s.claimed_on);
                      const paidNow =
                        s.pay_plan !== 'fully_paid' &&
                        currentWeek &&
                        payRows.some((p) => p.store_id === s.id && p.week_start === currentWeek.start);
                      return (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>{s.address || s.barangay || '—'}</td>
                          <td>{s.phone || '—'}</td>
                          <td>{s.age ?? '—'}</td>
                          <td>{s.gender ?? '—'}</td>
                          <td>
                            {s.pay_plan === 'fully_paid' || paidCount >= INSTALLMENT_WEEKS
                              ? 'Fully paid'
                              : `${paidCount}/${INSTALLMENT_WEEKS}${currentWeek ? (paidNow ? ' · this week paid' : ' · this week due') : ''}`}
                          </td>
                          <td>{s.will_reorder === true ? 'Yes' : s.will_reorder === false ? 'No' : '—'}</td>
                          <td style={{ maxWidth: 220, fontSize: '.78rem', color: 'var(--mid)' }}>
                            {[s.feedback_product, s.feedback_service].filter(Boolean).join(' · ') || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <Empty msg="No stores listed yet." />
              )}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <select value={fStore} onChange={(e) => setFStore(e.target.value)}>
            <option value="">All stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={fProduct} onChange={(e) => setFProduct(e.target.value)}>
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={fMat} onChange={(e) => setFMat(e.target.value)}>
            <option value="">All materials</option>
            {MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <input className="grow" placeholder="Search officer, store, product, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button
            className="btn-ghost"
            onClick={() => {
              setFStore('');
              setFMat('');
              setFProduct('');
              setQ('');
            }}
          >
            Clear
          </button>
        </div>

        <div className="card">
          <div className="card__b" style={{ padding: '6px 8px' }}>
            <div className="tablewrap">
              {filtered.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Store / source</th>
                      <th>Barangay</th>
                      <th>Product</th>
                      <th className="num">Qty</th>
                      <th className="num">Amount</th>
                      <th>Logged by</th>
                      <th aria-label="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const p = productById(products, r.product_id);
                      const s = storeById(r.store_id);
                      const roleClass = r.logged_by_role === 'cenro' ? 'role-cenro' : 'role-admin';
                      const amount = r.unit_price != null ? Number(r.unit_price) * Number(r.quantity) : null;
                      return (
                        <tr key={r.id}>
                          <td className="tstamp">{tstamp(r.created_at)}</td>
                          <td>{s?.name ?? '—'}</td>
                          <td className="mono" style={{ color: 'var(--mid)' }}>
                            {s?.barangay ?? '—'}
                          </td>
                          <td>
                            <span className="matpill">
                              <span className="d" style={{ background: p?.category === 'food' ? 'var(--yellow)' : 'var(--blue)' }} />
                              {p?.name ?? materialById(r.material).label}
                            </span>
                            {p && (
                              <div style={{ fontSize: '.7rem', color: 'var(--light)', marginTop: 3 }}>
                                {r.with_container ? 'with container' : 'price refill'}
                                {r.is_reorder ? ' · reorder' : ''}
                              </div>
                            )}
                          </td>
                          <td className="num">
                            {fmt(r.quantity)} <span style={{ color: 'var(--light)', fontWeight: 400 }}>{r.unit}</span>
                          </td>
                          <td className="num">{amount != null ? peso(amount) : '—'}</td>
                          <td>
                            <span className={`pill ${roleClass}`}>
                              <span className="d" />
                              {r.logged_by_name || '—'}
                            </span>
                          </td>
                          <td>
                            <button className="rowdel" onClick={() => del(r.id)} title="Delete entry" aria-label="Delete entry">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <Empty msg="No entries match your filters." />
              )}
            </div>
          </div>
        </div>

        <p className="footnote">
          Showing {filtered.length} of {rows.length} entries · updates stream in live as officers and stores log
          collections.
        </p>
      </main>
    </div>
  );
}
