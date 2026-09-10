import { WEEKLY_INSTALLMENT } from './types';

/** First collection Friday of the field study. */
export const INSTALLMENT_START = '2026-09-11';
export const INSTALLMENT_WEEKS = 9;

export { WEEKLY_INSTALLMENT };

export type InstallmentWeek = {
  week: number;
  start: string;
  end: string;
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(value: string, days: number): string {
  const d = parseYmd(value);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

/** Preceding Friday on or before this calendar day (Fri–Thu weeks). */
export function fridayWeekStart(ymdValue: string): string {
  const d = parseYmd(ymdValue);
  const offset = (d.getDay() - 5 + 7) % 7;
  d.setDate(d.getDate() - offset);
  return ymd(d);
}

/** Week 1 starts the Friday-week after the claim date. Legacy rows with no claim keep 11 Sep 2026. */
export function planStart(claimedOn?: string | null): string {
  if (!claimedOn) return INSTALLMENT_START;
  return addDays(fridayWeekStart(claimedOn), 7);
}

export function isInstallmentStore(
  store: { id?: string; pay_plan?: string | null; claimed_on?: string | null },
  payments?: { store_id: string; week_start: string; notes?: string | null }[]
): boolean {
  if (store.pay_plan === 'fully_paid') return false;
  if (Array.isArray(payments) && store.id && planPaidCount(payments, store.id, store.claimed_on) >= INSTALLMENT_WEEKS) {
    return false;
  }
  return true;
}

/** Unique ₱550 kit tags for a store, in the order they were paid. */
export function kitTags<T extends { store_id: string; week_start: string; notes?: string | null; paid_on?: string | null; created_at?: string; id?: string }>(
  payments: T[],
  storeId: string
): T[] {
  const seen = new Set<string>();
  const rows: T[] = [];
  const sorted = payments
    .filter((p) => p.store_id === storeId && isInstallmentTag(p))
    .slice()
    .sort((a, b) => {
      const da = weekKey(a.paid_on) || weekKey(a.week_start);
      const db = weekKey(b.paid_on) || weekKey(b.week_start);
      if (da !== db) return da.localeCompare(db);
      return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
    });
  for (const p of sorted) {
    const key = weekKey(p.week_start) || p.id || String(rows.length);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(p);
  }
  return rows;
}

export function installmentWeeks(claimedOn?: string | null): InstallmentWeek[] {
  const origin = planStart(claimedOn);
  return Array.from({ length: INSTALLMENT_WEEKS }, (_, i) => {
    const start = addDays(origin, i * 7);
    return { week: i + 1, start, end: addDays(start, 6) };
  });
}

export function installmentWeekFor(ymdValue: string, claimedOn?: string | null): InstallmentWeek | null {
  return installmentWeeks(claimedOn).find((w) => w.start <= ymdValue && ymdValue <= w.end) ?? null;
}

export function shortDay(ymdValue: string): string {
  return parseYmd(ymdValue).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
}

export function weekRangeLabel(week: InstallmentWeek): string {
  return `${shortDay(week.start)} – ${shortDay(week.end)}`;
}

export function weekKey(value: string | null | undefined): string {
  return String(value ?? '').slice(0, 10);
}

/** Product-order payments must not count as a weekly ₱550 collection tag. */
export function isInstallmentTag(payment: { notes?: string | null }): boolean {
  return !/Reorder/i.test(payment.notes ?? '');
}

export function planPaidCount(
  payments: { store_id: string; week_start: string; notes?: string | null }[],
  storeId: string,
  _claimedOn?: string | null
): number {
  return Math.min(INSTALLMENT_WEEKS, kitTags(payments, storeId).length);
}

export function planPendingCount(
  payments: { store_id: string; week_start: string; notes?: string | null }[],
  storeId: string,
  claimedOn?: string | null
): number {
  return Math.max(0, INSTALLMENT_WEEKS - planPaidCount(payments, storeId, claimedOn));
}

export function paymentForWeek<T extends { store_id: string; week_start: string; notes?: string | null; paid_on?: string | null; created_at?: string; id?: string }>(
  payments: T[],
  storeId: string,
  weekStart: string,
  claimedOn?: string | null
): T | undefined {
  const weeks = installmentWeeks(claimedOn);
  const idx = weeks.findIndex((w) => w.start === weekKey(weekStart));
  if (idx < 0) return undefined;
  return kitTags(payments, storeId)[idx];
}

/** A weekly tag is late if it is flagged in notes, or was paid after its week ended. */
export function isLatePaidWeek(
  payment: { paid_on?: string | null; notes?: string | null },
  week: InstallmentWeek
): boolean {
  if (/\bLate\b/i.test(payment.notes ?? '')) return true;
  const paidOn = weekKey(payment.paid_on);
  return Boolean(paidOn) && paidOn > week.end;
}

/** Notes-only late flag, for flat payment lists without week context. */
export function isLateTag(payment: { notes?: string | null }): boolean {
  return /\bLate\b/i.test(payment.notes ?? '');
}

/** The next still-unpaid weekly window, if its end date has already passed. */
export function overdueWeekFor(
  payments: { store_id: string; week_start: string; notes?: string | null; paid_on?: string | null; created_at?: string; id?: string }[],
  store: { id: string; pay_plan?: string | null; claimed_on?: string | null },
  today: string
): InstallmentWeek | null {
  if (!isInstallmentStore(store, payments as never)) return null;
  const paid = planPaidCount(payments, store.id, store.claimed_on);
  if (paid >= INSTALLMENT_WEEKS) return null;
  const next = installmentWeeks(store.claimed_on)[paid];
  return next && next.end < today ? next : null;
}

export function storesDueForFullyPaid<T extends { id: string; pay_plan?: string | null; claimed_on?: string | null }>(
  stores: T[],
  payments: { store_id: string; week_start: string; notes?: string | null }[]
): T[] {
  return stores.filter(
    (s) => s.pay_plan !== 'fully_paid' && planPaidCount(payments, s.id, s.claimed_on) >= INSTALLMENT_WEEKS
  );
}
