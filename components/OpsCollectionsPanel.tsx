'use client';

import { useMemo, useState } from 'react';
import { manilaYmd, peso } from '@/lib/format';
import {
  INSTALLMENT_WEEKS,
  WEEKLY_INSTALLMENT,
  installmentWeekFor,
  installmentWeeks,
  isInstallmentStore,
  isInstallmentTag,
  isLatePaidWeek,
  overdueWeekFor,
  paymentForWeek,
  planPaidCount,
  shortDay,
  weekRangeLabel,
} from '@/lib/installments';
import { storeSearchText, storeDisplayName } from '@/lib/storeProfile';
import type { Payment, Store } from '@/lib/types';
import { Empty } from './ui';

type PlanFilter = 'paying' | 'done' | 'all';

function payMethodOf(notes: string | null | undefined): string | null {
  const m = /^\[(Cash|GCash)\]/.exec(notes ?? '');
  return m?.[1] ?? null;
}

function lastPaidOn(payments: Payment[], storeId: string): string {
  const tags = payments
    .filter((p) => p.store_id === storeId && isInstallmentTag(p))
    .slice()
    .sort((a, b) => (b.paid_on || '').localeCompare(a.paid_on || ''));
  return (tags[0]?.paid_on || '').slice(0, 10);
}

function kitPaid(store: Store, payments: Payment[]): boolean {
  return !isInstallmentStore(store, payments);
}

export function OpsCollectionsPanel({
  stores,
  payments,
  onOpenStore,
}: {
  stores: Store[];
  payments: Payment[];
  onOpenStore: (store: Store) => void;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<PlanFilter>('paying');
  const [openId, setOpenId] = useState<string | null>(null);
  const today = manilaYmd();

  const rows = useMemo(() => {
    return stores
      .map((store) => {
        const paidWeeks = planPaidCount(payments, store.id, store.claimed_on);
        const collected = payments
          .filter((p) => p.store_id === store.id && isInstallmentTag(p))
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const done = kitPaid(store, payments);
        return {
          store,
          paidWeeks,
          collected,
          done,
          lastPaid: lastPaidOn(payments, store.id),
        };
      })
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (a.paidWeeks !== b.paidWeeks) return b.paidWeeks - a.paidWeeks;
        return storeDisplayName(a.store).localeCompare(storeDisplayName(b.store));
      });
  }, [stores, payments]);

  const paying = rows.filter((r) => !r.done);
  const done = rows.filter((r) => r.done);
  const kitTotal = payments.filter(isInstallmentTag).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    const pool = filter === 'paying' ? paying : filter === 'done' ? done : rows;
    if (!query) return pool;
    return pool.filter((r) => storeSearchText(r.store).includes(query));
  }, [q, filter, paying, done, rows]);

  const selected = openId ? stores.find((s) => s.id === openId) ?? null : null;
  const selectedRow = selected ? rows.find((r) => r.store.id === selected.id) ?? null : null;
  const planWeeks = selected ? installmentWeeks(selected.claimed_on) : [];
  const currentWeek = selected ? installmentWeekFor(today, selected.claimed_on) : null;

  return (
    <>
      <header className="pagehead">
        <p className="kicker">Starter kit</p>
        <h1>Collections</h1>
        <p className="sub">
          ₱{WEEKLY_INSTALLMENT} × {INSTALLMENT_WEEKS} weeks for the first kit. After the plan, stores only refill.
        </p>
      </header>

      <div className="crm-stats ops-stats">
        <div className="crm-stat">
          <strong>{paying.length}</strong>
          <span>Still paying</span>
        </div>
        <div className="crm-stat">
          <strong>{done.length}</strong>
          <span>Kit paid</span>
        </div>
        <div className="crm-stat">
          <strong>{peso(kitTotal)}</strong>
          <span>Collected</span>
        </div>
        <div className="crm-stat">
          <strong>{peso(WEEKLY_INSTALLMENT * INSTALLMENT_WEEKS)}</strong>
          <span>Full kit</span>
        </div>
      </div>

      <section className="sheet">
        <header className="sheet__h sheet__h--row">
          <div>
            <h3>Store plans</h3>
            <p className="sub">
              {paying.length} on installment · {done.length} ready to refill
            </p>
          </div>
          <div className="ops-toolbar">
            <div className="seg seg--3">
              <button type="button" className={filter === 'paying' ? 'is-on' : ''} onClick={() => setFilter('paying')}>
                Paying
              </button>
              <button type="button" className={filter === 'done' ? 'is-on' : ''} onClick={() => setFilter('done')}>
                Kit paid
              </button>
              <button type="button" className={filter === 'all' ? 'is-on' : ''} onClick={() => setFilter('all')}>
                All
              </button>
            </div>
            <label className="search">
              <span className="sr">Search stores</span>
              <input className="input" value={q} placeholder="Search store" onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
        </header>
        {visible.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Weeks</th>
                  <th>Collected</th>
                  <th>Last tag</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.store.id} className={openId === row.store.id ? 'is-on' : ''} onClick={() => setOpenId(row.store.id)}>
                    <td>
                      {storeDisplayName(row.store)}
                      <div className="s">{[row.store.store_code, row.store.city].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td>{`${row.paidWeeks}/${INSTALLMENT_WEEKS}`}</td>
                    <td>{row.collected ? peso(row.collected) : '—'}</td>
                    <td>{row.lastPaid ? shortDay(row.lastPaid) : '—'}</td>
                    <td>{row.done ? 'Kit paid · refill' : 'Installment'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty msg="No stores match that filter." />
        )}
      </section>

      {selected && selectedRow && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Kit collection">
          <button className="modal__scrim" type="button" aria-label="Close" onClick={() => setOpenId(null)} />
          <div className="modal__card modal__card--form">
            <header className="modal__head">
              <p className="kicker">Kit collection</p>
              <h3>{storeDisplayName(selected)}</h3>
              <p className="sub">
                {selectedRow.done
                  ? 'Starter kit is paid. This store only refills now.'
                  : `₱${WEEKLY_INSTALLMENT} × ${INSTALLMENT_WEEKS} for the first kit.`}
              </p>
            </header>

            <dl className="modal__facts">
              <div>
                <dt>Plan</dt>
                <dd>{selectedRow.done ? 'Fully paid' : 'Installment'}</dd>
              </div>
              <div>
                <dt>Weeks paid</dt>
                <dd>
                  {selectedRow.paidWeeks}/{INSTALLMENT_WEEKS}
                </dd>
              </div>
              <div>
                <dt>Collected</dt>
                <dd>{selectedRow.collected ? peso(selectedRow.collected) : '—'}</dd>
              </div>
              {selected.claimed_on ? (
                <div>
                  <dt>Claimed</dt>
                  <dd>{shortDay(selected.claimed_on.slice(0, 10))}</dd>
                </div>
              ) : null}
            </dl>

            {selectedRow.paidWeeks > 0 || !selectedRow.done ? (
              <>
                <p className="modal__label">Weekly ₱{WEEKLY_INSTALLMENT}</p>
                <div className="weeklist">
                  {planWeeks.map((week) => {
                    const payment = paymentForWeek(payments, selected.id, week.start, selected.claimed_on);
                    const isCurrent = currentWeek?.start === week.start;
                    return (
                      <div
                        className={`weekrow${isCurrent ? ' is-now' : ''}${payment ? ' is-paid' : ''}`}
                        key={week.start}
                      >
                        <div className="weekrow__n">{week.week}</div>
                        <div className="weekrow__body">
                          <div className="weekrow__h">
                            <div className="t">{weekRangeLabel(week)}</div>
                            {payment ? (
                              <span className="weekrow__paid-amt">{peso(Number(payment.amount))}</span>
                            ) : (
                              <span className="weekrow__paid-meta">{isCurrent ? 'Due this week' : 'Open'}</span>
                            )}
                          </div>
                          {payment ? (
                            <p className="weekrow__paid-meta">
                              {[payMethodOf(payment.notes), payment.logged_by_name, shortDay((payment.paid_on || '').slice(0, 10))]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="sub">This store skipped the weekly plan and only orders refills.</p>
            )}

            <div className="modal__actions">
              <button className="btn-ghost" type="button" onClick={() => setOpenId(null)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setOpenId(null);
                  onOpenStore(selected);
                }}
              >
                Open store
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
