import { peso, tstamp } from './format';
import { INSTALLMENT_WEEKS, addDays, planPaidCount, shortDay } from './installments';
import { storeDisplayName } from './storeProfile';
import { WEEKLY_INSTALLMENT, productById, type Collection, type Payment, type Product, type Store } from './types';

export function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function downloadFile(filename: string, contents: string, mime: string) {
  const blob = new Blob(['\uFEFF', contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ReorderTallyRow = {
  id: string;
  name: string;
  category: string;
  pack_qty: string;
  count: number;
  refill: number;
  container: number;
  amount: number;
};

export function reorderTally(orders: Collection[], products: Product[]): ReorderTallyRow[] {
  const reorders = orders.filter((r) => r.is_reorder);
  return products
    .map((p) => {
      const rows = reorders.filter((r) => r.product_id === p.id);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        pack_qty: p.pack_qty,
        count: rows.length,
        refill: rows.filter((r) => !r.with_container).length,
        container: rows.filter((r) => r.with_container).length,
        amount: rows.reduce((a, r) => a + Number(r.unit_price ?? 0) * Number(r.quantity || 1), 0),
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function storeName(stores: Store[], id: string): string {
  const store = stores.find((s) => s.id === id);
  return store ? storeDisplayName(store) : '—';
}

export function weekLabel(weekStart: string): string {
  return `${shortDay(weekStart)} – ${shortDay(addDays(weekStart, 6))}`;
}

export function buildFullCsv(opts: {
  stores: Store[];
  payments: Payment[];
  orders: Collection[];
  products: Product[];
  officer: string;
  scope: string;
}): string {
  const { stores, payments, orders, products, officer, scope } = opts;
  const head = [
    'record_type',
    'timestamp',
    'store_code',
    'arrp_id',
    'store',
    'address',
    'phone',
    'age',
    'gender',
    'classification',
    'pay_plan',
    'will_reorder',
    'collection_weeks',
    'week',
    'paid_on',
    'amount',
    'product',
    'price_type',
    'quantity',
    'unit_price',
    'feedback_product',
    'feedback_service',
    'officer',
    'scope',
    'notes',
  ];
  const rows: string[][] = [];

  for (const s of stores) {
    rows.push([
      'store',
      tstamp(s.created_at),
      s.store_code ?? '',
      s.arrp_id ?? '',
      storeDisplayName(s),
      [s.barangay, s.city, s.address].filter((v) => v && v !== '—').join(', ') || '',
      s.phone,
      s.age ?? '',
      s.gender ?? '',
      s.classification ?? '',
      s.pay_plan ?? '',
      s.will_reorder === true ? 'yes' : s.will_reorder === false ? 'no' : '',
      s.pay_plan === 'fully_paid' || planPaidCount(payments, s.id, s.claimed_on) >= INSTALLMENT_WEEKS
        ? 'fully paid'
        : `${planPaidCount(payments, s.id, s.claimed_on)}/${INSTALLMENT_WEEKS}`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      s.feedback_product,
      s.feedback_service,
      officer,
      scope,
      '',
    ].map(String));
  }

  for (const p of payments) {
    const store = stores.find((s) => s.id === p.store_id);
    rows.push([
      'collection',
      tstamp(p.created_at),
      store?.store_code ?? '',
      store?.arrp_id ?? '',
      storeName(stores, p.store_id),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      weekLabel(p.week_start),
      p.paid_on,
      p.amount,
      '',
      '',
      '',
      '',
      '',
      '',
      p.logged_by_name || officer,
      scope,
      p.notes,
    ].map(String));
  }

  for (const r of orders) {
    const p = productById(products, r.product_id);
    rows.push([
      r.is_reorder ? 'reorder' : 'refill',
      tstamp(r.created_at),
      stores.find((s) => s.id === r.store_id)?.store_code ?? '',
      stores.find((s) => s.id === r.store_id)?.arrp_id ?? '',
      storeName(stores, r.store_id),
      '',
      '',
      '',
      '',
      '',
      '',
      r.is_reorder ? 'yes' : '',
      '',
      '',
      '',
      Number(r.unit_price ?? 0) * Number(r.quantity || 1),
      p?.name ?? '',
      r.with_container ? 'with container' : 'refill',
      r.quantity,
      r.unit_price ?? '',
      '',
      '',
      r.logged_by_name || officer,
      scope,
      r.notes,
    ].map(String));
  }

  return [head.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n');
}

function csvTable(head: string[], rows: unknown[][]): string {
  return [head.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n');
}

export function buildStoresCsv(stores: Store[], payments: Payment[]): string {
  return csvTable(
    ['store_code', 'arrp_id', 'store', 'first_name', 'last_name', 'city', 'barangay', 'phone', 'classification', 'pay_plan', 'claimed_on', 'weeks_paid', 'active'],
    stores.map((s) => [
      s.store_code,
      s.arrp_id,
      storeDisplayName(s),
      s.first_name,
      s.last_name,
      s.city,
      s.barangay,
      s.phone,
      s.classification,
      s.pay_plan,
      (s.claimed_on || '').slice(0, 10),
      s.pay_plan === 'fully_paid' || planPaidCount(payments, s.id, s.claimed_on) >= INSTALLMENT_WEEKS
        ? 'fully paid'
        : `${planPaidCount(payments, s.id, s.claimed_on)}/${INSTALLMENT_WEEKS}`,
      s.active === false ? 'no' : 'yes',
    ])
  );
}

export function buildPaymentsCsv(stores: Store[], payments: Payment[]): string {
  return csvTable(
    ['tagged_at', 'store_code', 'store', 'amount', 'paid_on', 'week_start', 'officer', 'notes'],
    payments.map((p) => [
      tstamp(p.created_at),
      stores.find((s) => s.id === p.store_id)?.store_code ?? '',
      storeName(stores, p.store_id),
      p.amount,
      p.paid_on,
      p.week_start,
      p.logged_by_name,
      p.notes,
    ])
  );
}

export function buildOrdersCsv(stores: Store[], products: Product[], orders: Collection[]): string {
  return csvTable(
    ['when', 'store_code', 'store', 'type', 'product', 'price_type', 'quantity', 'unit_price', 'line_total', 'officer', 'notes'],
    orders.map((r) => {
      const p = productById(products, r.product_id);
      const qty = Number(r.quantity || 1);
      const price = Number(r.unit_price ?? 0);
      return [
        tstamp(r.created_at),
        stores.find((s) => s.id === r.store_id)?.store_code ?? '',
        storeName(stores, r.store_id),
        r.is_reorder ? 'reorder' : 'refill',
        p?.name ?? '',
        r.with_container ? 'with container' : 'refill',
        qty,
        r.unit_price ?? '',
        r.unit_price != null ? price * qty : '',
        r.logged_by_name,
        r.notes,
      ];
    })
  );
}

export function buildDocHtml(opts: {
  stores: Store[];
  payments: Payment[];
  orders: Collection[];
  products: Product[];
  officer: string;
  scope: string;
  generated: string;
}): string {
  const tally = reorderTally(opts.orders, opts.products);
  const collected = opts.payments.reduce((a, p) => a + Number(p.amount), 0);
  const reorderTotal = tally.reduce((a, r) => a + r.amount, 0);
  const will = opts.stores.filter((s) => s.will_reorder).length;

  const table = (headers: string[], body: string[][]) =>
    `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px">
      <tr>${headers.map((h) => `<th style="text-align:left;background:#f4f6f5">${esc(h)}</th>`).join('')}</tr>
      ${body.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}
    </table>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>RefillKa Field Report</title></head>
<body style="font-family:Georgia,serif;color:#121A16;max-width:800px;margin:24px auto;padding:0 16px">
  <p style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#1B5E3B;font-weight:700">RefillKa · Taguig field study</p>
  <h1>Field collection report</h1>
  <p>${esc(opts.generated)} · ${esc(opts.officer)} · ${esc(opts.scope)}</p>
  <p><strong>${opts.stores.length}</strong> stores · <strong>${opts.payments.length}</strong> weekly collections (${esc(peso(collected))}) · <strong>${will}</strong> will reorder · <strong>${tally.reduce((a, r) => a + r.count, 0)}</strong> reorder lines (${esc(peso(reorderTotal))})</p>
  <h2>Reorder tally</h2>
  ${
    tally.length
      ? table(
          ['Product', 'Category', 'Orders', 'Refill', 'With container', 'Amount'],
          tally.map((r) => [r.name, r.category, String(r.count), String(r.refill), String(r.container), peso(r.amount)])
        )
      : '<p>No reorders logged yet.</p>'
  }
  <h2>Stores</h2>
  ${table(
    ['Store', 'Address', 'Number', 'Age', 'Gender', 'Weeks paid', 'Will reorder', 'Product feedback', 'Service feedback'],
    opts.stores.map((s) => [
      s.name,
      [s.barangay, s.city, s.address].filter((v) => v && v !== '—').join(', ') || '',
      s.phone || '',
      s.age != null ? String(s.age) : '',
      s.gender ?? '',
      s.pay_plan === 'fully_paid' || planPaidCount(opts.payments, s.id, s.claimed_on) >= INSTALLMENT_WEEKS
        ? 'Fully paid'
        : `${planPaidCount(opts.payments, s.id, s.claimed_on)}/${INSTALLMENT_WEEKS}`,
      s.will_reorder === true ? 'Yes' : s.will_reorder === false ? 'No' : '',
      s.feedback_product,
      s.feedback_service,
    ])
  )}
  <h2>Weekly collections (₱${WEEKLY_INSTALLMENT} × ${INSTALLMENT_WEEKS} weeks)</h2>
  ${
    opts.payments.length
      ? table(
          ['When tagged', 'Store', 'Week', 'Paid on', 'Amount', 'Officer'],
          opts.payments.map((p) => [
            tstamp(p.created_at),
            storeName(opts.stores, p.store_id),
            weekLabel(p.week_start),
            p.paid_on,
            peso(Number(p.amount)),
            p.logged_by_name,
          ])
        )
      : '<p>No collections tagged yet.</p>'
  }
  <h2>Refills and reorders</h2>
  ${
    opts.orders.length
      ? table(
          ['When', 'Store', 'Product', 'Type', 'Reorder', 'Amount', 'Officer'],
          opts.orders.map((r) => {
            const p = productById(opts.products, r.product_id);
            return [
              tstamp(r.created_at),
              storeName(opts.stores, r.store_id),
              p?.name ?? 'Refill',
              r.with_container ? 'With container' : 'Refill',
              r.is_reorder ? 'Yes' : 'No',
              r.unit_price != null ? peso(Number(r.unit_price) * Number(r.quantity || 1)) : '',
              r.logged_by_name,
            ];
          })
        )
      : '<p>No product orders yet.</p>'
  }
</body></html>`;
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
