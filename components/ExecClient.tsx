'use client';

import { useMemo } from 'react';
import { useCollections } from '@/lib/hooks/useCollections';
import { PILOT_TARGET, WEEKLY_INSTALLMENT, productById, toSachetEquiv, type Lgu, type Payment, type Product, type Profile, type Store } from '@/lib/types';
import { fmt, manilaYmd, peso } from '@/lib/format';
import { splitLiveData } from '@/lib/demo';
import { INSTALLMENT_WEEKS, installmentWeekFor } from '@/lib/installments';
import { usePayments } from '@/lib/hooks/usePayments';
import { Topbar } from './Topbar';
import { Kpi, Bar, Empty } from './ui';

const BRGY_COLORS = ['#2E7D4F', '#2390C9', '#2A7C78', '#DC2F29', '#B8860B', '#8a6d04'];

export function ExecClient({
  profile,
  scope,
  stores: allStores,
  products,
  payments = [],
  initial,
  lgus = [],
}: {
  profile: Profile;
  scope: string;
  stores: Store[];
  products: Product[];
  payments?: Payment[];
  initial: any[];
  lgus?: Lgu[];
}) {
  const { rows: liveOrders, status } = useCollections(initial);
  const { rows: livePays } = usePayments(payments);
  const scoped = splitLiveData(profile, { stores: allStores, orders: liveOrders, payments: livePays, lgus });
  const stores = scoped.stores;
  const rows = scoped.orders;
  const payRows = scoped.payments;

  const sachet = rows.reduce((a, r) => a + toSachetEquiv(r), 0);
  const pct = Math.min(100, (sachet / PILOT_TARGET) * 100);
  const gallons = rows
    .filter((r) => r.product_id || r.material === 'refill')
    .reduce((a, r) => a + Number(r.quantity), 0);
  const sales = rows.reduce((a, r) => a + (r.unit_price != null ? Number(r.unit_price) * Number(r.quantity) : 0), 0);
  const currentWeek = installmentWeekFor(manilaYmd());
  const collectedWeek = currentWeek
    ? payRows
        .filter((p) => p.week_start === currentWeek.start)
        .reduce((a, p) => a + Number(p.amount), 0)
    : 0;
  const willReorder = stores.filter((s) => s.will_reorder).length;

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; gal: number; color: string }>();
    for (const r of rows) {
      const p = productById(products, r.product_id);
      if (!p) continue;
      const cur = map.get(p.id) ?? {
        name: p.name,
        gal: 0,
        color: p.category === 'food' ? '#F0D709' : '#2390C9',
      };
      cur.gal += Number(r.quantity);
      map.set(p.id, cur);
    }
    return [...map.values()].sort((a, b) => b.gal - a.gal);
  }, [rows, products]);
  const maxProduct = Math.max(1, ...byProduct.map((p) => p.gal));

  const byBrgy = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const b = stores.find((s) => s.id === r.store_id)?.barangay ?? '—';
      map.set(b, (map.get(b) ?? 0) + Number(r.quantity));
    }
    return [...map.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  }, [rows, stores]);
  const maxBrgy = Math.max(1, ...byBrgy.map((b) => b.v));

  return (
    <div className="app">
      <Topbar role={profile.role} name={profile.full_name || 'Executive'} meta={scope} officerId={profile.officer_id} status={status} />
      <main className="main">
        <div className="viewhead">
          <div>
            <h1>Executive Dashboard</h1>
            <p className="sub">
              Live impact across <strong>{scope}</strong> — for the Mayor&apos;s office, regional directors,
              ownership and program leadership.
            </p>
          </div>
        </div>

        <div className="banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          Read-only view. Figures update in real time as CENRO officers and stores log collections.
        </div>

        <div className="kpis">
          <Kpi label="Collections this week" value={peso(collectedWeek)} unit={`${peso(WEEKLY_INSTALLMENT)} × ${INSTALLMENT_WEEKS} weeks from Sep 11`} accent="var(--green-deep)" />
          <Kpi label="Gallons refilled" value={fmt(gallons)} unit="product orders" accent="var(--blue)" />
          <Kpi label="Will reorder" value={willReorder} unit={`of ${stores.length} stores`} accent="var(--teal)" />
          <Kpi label="Refill order value" value={peso(sales)} unit="refill + container" accent="var(--red)" />
        </div>

        <div className="grid side">
          <div className="card chartcard">
            <div className="card__h">
              <h3>Daily collection activity</h3>
              <span className="tag">last 14 days</span>
            </div>
            <div className="card__b">
              <SparkArea rows={rows} />
            </div>
          </div>

          <div className="card">
            <div className="card__h">
              <h3>1 Billion Challenge</h3>
              <span className="tag">pilot target</span>
            </div>
            <div className="card__b">
              <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: '2.4rem', lineHeight: 1 }}>
                {pct.toFixed(1)}
                <span style={{ fontSize: '1.1rem', color: 'var(--mid)' }}>%</span>
              </div>
              <div style={{ color: 'var(--mid)', fontSize: '.84rem', margin: '6px 0 14px' }}>
                of the <strong>{fmt(PILOT_TARGET)}</strong> sachet-equivalent field-study target
              </div>
              <div className="progressbar">
                <div className="progressfill" style={{ width: `${pct}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.74rem', color: 'var(--light)', marginTop: 8 }}>
                <span>{fmt(sachet)} diverted</span>
                <span>Goal {fmt(PILOT_TARGET)}</span>
              </div>
              <p style={{ fontSize: '.78rem', color: 'var(--mid)', marginTop: 16, lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                Nationally, RefillKa aims to prevent <strong>1 billion</strong> single-use plastics per year by
                2030. This pilot measures the Taguig contribution.
              </p>
            </div>
          </div>
        </div>

        <div className="grid cols2" style={{ marginTop: 16 }}>
          <div className="card chartcard">
            <div className="card__h">
              <h3>Orders by product</h3>
            </div>
            <div className="card__b">
              {byProduct.length ? (
                byProduct.map((p) => (
                  <Bar key={p.name} label={p.name} value={p.gal} max={maxProduct} color={p.color} unit="gal" />
                ))
              ) : (
                <Empty msg="No data yet." />
              )}
            </div>
          </div>
          <div className="card chartcard">
            <div className="card__h">
              <h3>Volume by barangay</h3>
            </div>
            <div className="card__b">
              {byBrgy.length ? (
                byBrgy.map((b, i) => <Bar key={b.k} label={b.k} value={b.v} max={maxBrgy} color={BRGY_COLORS[i % BRGY_COLORS.length]} />)
              ) : (
                <Empty msg="No data yet." />
              )}
            </div>
          </div>
        </div>

        <p className="footnote">
          RefillKa · ReCirca Management Corp × City Government of Taguig · pre-pilot Monitored Field Study
        </p>
      </main>
    </div>
  );
}

function SparkArea({ rows }: { rows: any[] }) {
  const days = 14;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const buckets: { d: Date; cnt: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const cnt = rows.filter((r) => {
      const t = new Date(r.created_at);
      return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth() && t.getDate() === d.getDate();
    }).length;
    buckets.push({ d, cnt });
  }
  const max = Math.max(1, ...buckets.map((b) => b.cnt));
  const W = 560, H = 190, pad = 28, iw = W - pad * 2, ih = H - pad * 2;
  const x = (i: number) => pad + (iw * i) / (days - 1);
  const y = (v: number) => pad + ih - (ih * v) / max;
  const pts = buckets.map((b, i) => [x(i), y(b.cnt)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `M${pad} ${pad + ih} ` + pts.map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ` L${pad + iw} ${pad + ih} Z`;
  const ticks = [0, Math.round(max / 2), max];

  return (
    <svg className="line" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily collection entries, last 14 days">
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--green)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--green)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad} y1={y(v)} x2={pad + iw} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
          <text className="tick" x={pad - 6} y={y(v) + 3} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#ag)" />
      <path d={line} fill="none" stroke="var(--green)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) =>
        i % 2 === 0 || i === days - 1 ? (
          <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r={i === days - 1 ? 3.4 : 2.4} fill="var(--green)" />
        ) : null
      )}
      {buckets.map((b, i) =>
        i % 2 === 0 || i === days - 1 ? (
          <text key={i} className="tick" x={x(i)} y={H - 6} textAnchor="middle">
            {b.d.getMonth() + 1}/{b.d.getDate()}
          </text>
        ) : null
      )}
    </svg>
  );
}
