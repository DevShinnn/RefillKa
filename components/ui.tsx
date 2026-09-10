'use client';

import { fmt } from '@/lib/format';

/** Imperative toast (single shared node). */
export function toast(msg: string) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('rk-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rk-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  el.appendChild(document.createTextNode(msg));
  el.classList.add('show');
  window.clearTimeout((el as any)._t);
  (el as any)._t = window.setTimeout(() => el!.classList.remove('show'), 2600);
}

export function Kpi({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
}) {
  return (
    <div className="kpi" style={accent ? ({ ['--accent' as any]: accent }) : undefined}>
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {unit && <div className="u">{unit}</div>}
    </div>
  );
}

export function Bar({
  label,
  value,
  max,
  color,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  unit?: string;
}) {
  const w = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="barrow">
      <div className="bl" title={label}>
        {label}
      </div>
      <div className="bartrack">
        <div className="barfill" style={{ width: `${w}%`, background: color }} />
      </div>
      <div className="bv">
        {fmt(value)}
        {unit ? <span style={{ color: 'var(--light)', fontWeight: 400, fontSize: '.72rem' }}> {unit}</span> : null}
      </div>
    </div>
  );
}

export function Empty({ msg }: { msg: string }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <rect x="7" y="11" width="3" height="6" />
        <rect x="12" y="7" width="3" height="10" />
        <rect x="17" y="13" width="3" height="4" />
      </svg>
      <p>{msg}</p>
    </div>
  );
}
