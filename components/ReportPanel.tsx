'use client';

import { manilaDateLabel, manilaTimeLabel, manilaYmd, peso } from '@/lib/format';
import { INSTALLMENT_WEEKS, planPaidCount, planPendingCount } from '@/lib/installments';
import { isPendingOrder, orderLineTotal } from '@/lib/orders';
import {
  buildFullCsv,
  buildOrdersCsv,
  buildPaymentsCsv,
  buildStoresCsv,
  downloadFile,
  reorderTally,
} from '@/lib/report';
import { withoutDemoRows, withoutDemoStores } from '@/lib/demo';
import { storeDisplayName } from '@/lib/storeProfile';
import { type Collection, type Payment, type Product, type Store } from '@/lib/types';
import { Empty, toast } from './ui';

export function ReportPanel({
  stores: allStores,
  products,
  orders: allOrders,
  payments: allPayments,
  officer,
  officerId,
  scope,
}: {
  stores: Store[];
  products: Product[];
  orders: Collection[];
  payments: Payment[];
  officer: string;
  officerId?: string | null;
  scope: string;
}) {
  const stores = withoutDemoStores(allStores);
  const orders = withoutDemoRows(allOrders, allStores);
  const payments = withoutDemoRows(allPayments, allStores);
  const generated = `${manilaDateLabel()} · ${manilaTimeLabel()}`;
  const day = manilaYmd();
  const tally = reorderTally(orders, products);
  const collected = payments.reduce((a, p) => a + Number(p.amount), 0);
  const pendingOrders = orders.filter(isPendingOrder);
  const pendingAmount = pendingOrders.reduce((a, r) => a + orderLineTotal(r), 0);
  const officerLine = [officer, officerId].filter(Boolean).join(' · ');
  const csvOpts = { stores, payments, orders, products, officer: officerLine, scope };

  const save = (name: string, csv: string) => {
    downloadFile(`refillka-${name}-${day}.csv`, csv, 'text/csv;charset=utf-8');
    toast('CSV downloaded');
  };

  return (
    <div className="report">
      <header className="pagehead pagehead--split">
        <div>
          <p className="kicker">Report</p>
          <h1>Field snapshot</h1>
          <p className="sub">
            {officerLine} · {scope} · {generated}
          </p>
        </div>
        <div className="report-export no-print">
          <button type="button" className="btn-ghost" onClick={() => save('stores', buildStoresCsv(stores, payments))}>
            Stores CSV
          </button>
          <button type="button" className="btn-ghost" onClick={() => save('collections', buildPaymentsCsv(stores, payments))}>
            Collections CSV
          </button>
          <button type="button" className="btn-ghost" onClick={() => save('orders', buildOrdersCsv(stores, products, orders))}>
            Orders CSV
          </button>
          <button type="button" className="btn btn-primary pagehead__save" onClick={() => save('report', buildFullCsv(csvOpts))}>
            Export CSV
          </button>
        </div>
      </header>

      <div className="crm-stats">
        <div className="crm-stat">
          <strong>{stores.length}</strong>
          <span>Stores</span>
        </div>
        <div className="crm-stat">
          <strong>{peso(collected)}</strong>
          <span>Kit collections</span>
        </div>
        <div className="crm-stat">
          <strong>{pendingOrders.length}</strong>
          <span>Pending refills</span>
        </div>
        <div className="crm-stat">
          <strong>{pendingAmount ? peso(pendingAmount) : '₱0'}</strong>
          <span>To fulfill</span>
        </div>
      </div>

      <div className="report-grid">
        <section className="sheet">
          <header className="sheet__h">
            <p className="kicker">Reorders</p>
            <h3>By product</h3>
          </header>
          {tally.length ? (
            <div className="tablewrap report-table">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Lines</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {tally.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.name}
                        <div className="s">
                          {r.refill} refill · {r.container} container
                        </div>
                      </td>
                      <td className="num">{r.count}</td>
                      <td className="num">{peso(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty msg="No reorders yet." />
          )}
        </section>

        <section className="sheet">
          <header className="sheet__h">
            <p className="kicker">Accounts</p>
            <h3>Stores</h3>
          </header>
          {stores.length ? (
            <div className="tablewrap report-table">
              <table>
                <thead>
                  <tr>
                    <th>Store</th>
                    <th>Paid</th>
                    <th>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {storeDisplayName(s)}
                        {s.store_code || s.arrp_id ? (
                          <div className="s">{[s.store_code, s.arrp_id].filter(Boolean).join(' · ')}</div>
                        ) : null}
                        <div className="s">
                          {[s.barangay, s.city].filter((v) => v && v !== '—').join(', ') || s.address || '—'}
                        </div>
                      </td>
                      <td className="num">
                        {s.pay_plan === 'fully_paid' || planPaidCount(payments, s.id, s.claimed_on) >= INSTALLMENT_WEEKS
                          ? 'Full'
                          : `${planPaidCount(payments, s.id, s.claimed_on)}/${INSTALLMENT_WEEKS}`}
                      </td>
                      <td className="num">
                        {s.pay_plan === 'fully_paid' || planPaidCount(payments, s.id, s.claimed_on) >= INSTALLMENT_WEEKS
                          ? '—'
                          : planPendingCount(payments, s.id, s.claimed_on)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty msg="No stores yet." />
          )}
        </section>
      </div>
    </div>
  );
}
