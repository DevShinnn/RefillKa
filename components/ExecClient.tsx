'use client';

import { useMemo } from 'react';
import { useCollections } from '@/lib/hooks/useCollections';
import { MATERIALS, PILOT_TARGET, toSachetEquiv, type Profile, type Store } from '@/lib/types';
import { fmt, isToday } from '@/lib/format';
import { Topbar } from './Topbar';
import { Kpi, Bar, Empty } from './ui';

const BRGY_COLORS = ['#2E7D4F', '#2390C9', '#2A7C78', '#DC2F29', '#B8860B', '#8a6d04'];

export function ExecClient({
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
  const { rows, status } = useCollections(initial);

  const sachet = rows.reduce((a, r) => a + toSachetEquiv(r), 0);
  const pct = Math.min(100, (sachet / PILOT_TARGET) * 100);
  const refill = rows.filter((r) => r.material === 'refill').reduce((a, r) => a + Number(r.quantity), 0);
  const activeStores = new Set(rows.map((r) => r.store_id)).size;
  const today = rows.filter((r) => isToday(r.created_at)).length;

  const byMat = useMemo(
    () =>
      MATERIALS.map((m) => ({
        ...m,
        val: rows.filter((r) => r.material === m.id).reduce((a, r) => a + Number(r.quantity), 0),
      }))
        .filter((m) => m.val > 0)
        .sort((a, b) => b.val - a.val),
    [rows]
  );
  const maxMat = Math.max(1, ...byMat.map((m) => m.val));

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
      <Topbar role={profile.role} name={profile.full_name || 'Executive'} meta={scope} status={status} />
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
          <Kpi label="Sachet-equiv. diverted" value={fmt(sachet)} unit="weighted diversion units" accent="var(--green-deep)" />
          <Kpi label="Refill dispensed" value={fmt(refill)} unit="litres, bulk refilling" accent="var(--blue)" />
          <Kpi label="Active refill points" value={activeStores} unit={`of ${stores.length} in study`} accent="var(--teal)" />
          <Kpi label="Collections today" value={today} unit={`${rows.length} total entries`} accent="var(--red)" />
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
              <h3>Collections by material</h3>
            </div>
            <div className="card__b">
              {byMat.length ? (
                byMat.map((m) => <Bar key={m.id} label={m.label} value={m.val} max={maxMat} color={m.color} unit={m.unit} />)
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
