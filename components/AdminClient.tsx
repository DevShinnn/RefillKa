'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCollections } from '@/lib/hooks/useCollections';
import { MATERIALS, materialById, toSachetEquiv, type Profile, type Store } from '@/lib/types';
import { fmt, tstamp, isToday } from '@/lib/format';
import { Topbar } from './Topbar';
import { Kpi, Empty, toast } from './ui';

export function AdminClient({
  profile,
  scope,
  stores,
  initial,
}: {
  profile: Profile;
  scope: string;
  stores: Store[];
  initial: any[];
}) {
  const { rows, status, setRows } = useCollections(initial);
  const supabase = useMemo(() => createClient(), []);

  const [fStore, setFStore] = useState('');
  const [fMat, setFMat] = useState('');
  const [q, setQ] = useState('');

  const storeById = (id: string) => stores.find((s) => s.id === id);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (fStore && r.store_id !== fStore) return false;
      if (fMat && r.material !== fMat) return false;
      if (query) {
        const s = storeById(r.store_id);
        const hay = [r.logged_by_name, s?.name, s?.barangay, r.notes, materialById(r.material).label]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rows, fStore, fMat, q, stores]);

  const activeStores = new Set(rows.map((r) => r.store_id)).size;
  const contributors = new Set(rows.map((r) => r.logged_by)).size;
  const sachet = rows.reduce((a, r) => a + toSachetEquiv(r), 0);

  const del = async (id: string) => {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    setRows((prev) => prev.filter((r) => r.id !== id)); // optimistic
    const { error } = await supabase.from('collections').delete().eq('id', id);
    if (error) toast('Delete failed');
  };

  const exportCSV = () => {
    const head = ['timestamp_iso', 'timestamp_local', 'store', 'barangay', 'channel', 'material', 'quantity', 'unit', 'logged_by', 'role', 'notes'];
    const body = filtered.map((r) => {
      const s = storeById(r.store_id);
      return [
        r.collected_at,
        tstamp(r.created_at),
        s?.name ?? '',
        s?.barangay ?? '',
        s?.channel ?? '',
        materialById(r.material).label,
        r.quantity,
        r.unit,
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
      <Topbar role={profile.role} name={profile.full_name || 'Admin'} meta={scope} status={status} />
      <main className="main">
        <div className="viewhead">
          <div>
            <h1>Admin — All Collections</h1>
            <p className="sub">Full live ledger across the field study. Filter, review, export, and correct entries.</p>
          </div>
          <button className="btn-sm" onClick={exportCSV}>
            ⭳ Export CSV
          </button>
        </div>

        <div className="kpis">
          <Kpi label="Total entries" value={fmt(rows.length)} unit={`${rows.filter((r) => isToday(r.created_at)).length} logged today`} accent="var(--teal)" />
          <Kpi label="Active stores" value={activeStores} unit={`of ${stores.length} in study`} accent="var(--green)" />
          <Kpi label="Contributors" value={contributors} unit="CENRO + stores" accent="var(--blue)" />
          <Kpi label="Sachet-equiv. diverted" value={fmt(sachet)} unit="weighted total" accent="var(--red)" />
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
          <select value={fMat} onChange={(e) => setFMat(e.target.value)}>
            <option value="">All materials</option>
            {MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <input className="grow" placeholder="Search officer, store, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button
            className="btn-ghost"
            onClick={() => {
              setFStore('');
              setFMat('');
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
                      <th>Material</th>
                      <th className="num">Qty</th>
                      <th>Logged by</th>
                      <th aria-label="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const m = materialById(r.material);
                      const s = storeById(r.store_id);
                      const roleClass = r.logged_by_role === 'cenro' ? 'role-cenro' : 'role-admin';
                      return (
                        <tr key={r.id}>
                          <td className="tstamp">{tstamp(r.created_at)}</td>
                          <td>{s?.name ?? '—'}</td>
                          <td className="mono" style={{ color: 'var(--mid)' }}>
                            {s?.barangay ?? '—'}
                          </td>
                          <td>
                            <span className="matpill">
                              <span className="d" style={{ background: m.color }} />
                              {m.label}
                            </span>
                          </td>
                          <td className="num">
                            {fmt(r.quantity)} <span style={{ color: 'var(--light)', fontWeight: 400 }}>{r.unit}</span>
                          </td>
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
