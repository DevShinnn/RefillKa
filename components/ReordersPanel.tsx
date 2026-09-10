'use client';

import { useMemo, useRef, useState } from 'react';
import { FilterMenu } from './FilterMenu';
import { peso, tstamp } from '@/lib/format';
import {
  isPastOrder,
  isPendingOrder,
  orderLineTotal,
  parseOrderPay,
  type OrderPay,
} from '@/lib/orders';
import { storeCityName } from '@/lib/phPlaces';
import { reorderTally } from '@/lib/report';
import { isInstallmentTag } from '@/lib/installments';
import { storeDisplayName } from '@/lib/storeProfile';
import { productById, type Collection, type Payment, type Product, type Store } from '@/lib/types';
import { ConfirmModal } from './ConfirmModal';
import { Empty } from './ui';

type StatusFilter = 'pending' | 'past' | 'all';
type DateSort = 'newest' | 'oldest';

function orderDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
    return m?.[1] ?? '';
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return y && m && day ? `${y}-${m}-${day}` : '';
}

function orderOnDate(order: Collection, ymd: string): boolean {
  return orderDay(order.created_at) === ymd || orderDay(order.collected_at) === ymd;
}

function shortDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function statusChip(pay: OrderPay): { label: string; className: string } {
  if (pay.deliveredOn !== null) {
    return {
      label: pay.deliveredOn ? `Delivered ${shortDay(pay.deliveredOn)}` : 'Delivered',
      className: 'chip chip--ok',
    };
  }
  if (pay.dueOn) return { label: `Due ${shortDay(pay.dueOn)}`, className: 'chip chip--pending' };
  if (pay.method) return { label: `Paid ${pay.method}`, className: 'chip chip--due' };
  return { label: 'Pending', className: 'chip chip--pending' };
}

export function ReordersPanel({
  stores,
  products,
  orders,
  payments = [],
  busy,
  onOpenStore,
  onMarkDelivered,
  onDelete,
}: {
  stores: Store[];
  products: Product[];
  orders: Collection[];
  payments?: Payment[];
  busy: boolean;
  onOpenStore: (store: Store) => void;
  onMarkDelivered: (order: Collection) => void;
  onDelete?: (order: Collection) => void;
}) {
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [city, setCity] = useState('all');
  const [storeId, setStoreId] = useState('all');
  const [orderDate, setOrderDate] = useState('');
  const [dateSort, setDateSort] = useState<DateSort>('newest');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Collection | null>(null);
  const [view, setView] = useState<Collection | null>(null);
  const [remove, setRemove] = useState<Collection | null>(null);

  const reorders = useMemo(() => orders.filter((r) => r.is_reorder), [orders]);
  const pending = useMemo(() => reorders.filter(isPendingOrder), [reorders]);
  const past = useMemo(() => reorders.filter(isPastOrder), [reorders]);

  const storeOptions = useMemo(() => {
    const ids = new Set(reorders.map((r) => r.store_id));
    return stores.filter((s) => ids.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [reorders, stores]);

  const cityOptions = useMemo(() => {
    const names = [...new Set(storeOptions.map(storeCityName))].sort((a, b) => a.localeCompare(b));
    return [{ value: 'all', label: 'All cities' }, ...names.map((name) => ({ value: name, label: name }))];
  }, [storeOptions]);

  const storesInCity = useMemo(() => {
    if (city === 'all') return storeOptions;
    return storeOptions.filter((s) => storeCityName(s) === city);
  }, [storeOptions, city]);

  const storeFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All stores' },
      ...storesInCity.map((s) => ({ value: s.id, label: s.name })),
    ],
    [storesInCity],
  );

  const visible = useMemo(() => {
    let pool = status === 'pending' ? pending : status === 'past' ? past : reorders;
    if (city !== 'all') {
      pool = pool.filter((r) => {
        const store = stores.find((s) => s.id === r.store_id);
        return store ? storeCityName(store) === city : false;
      });
    }
    if (storeId !== 'all') pool = pool.filter((r) => r.store_id === storeId);
    if (orderDate) pool = pool.filter((r) => orderOnDate(r, orderDate));
    const dir = dateSort === 'oldest' ? 1 : -1;
    return [...pool].sort((a, b) => dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
  }, [status, pending, past, reorders, city, storeId, orderDate, dateSort, stores]);

  const tally = useMemo(() => reorderTally(visible, products), [visible, products]);
  const food = tally.filter((r) => r.category === 'food');
  const nonfood = tally.filter((r) => r.category === 'nonfood');

  const pendingAmount = pending.reduce((a, r) => a + orderLineTotal(r), 0);
  const lineCount = tally.reduce((a, r) => a + r.count, 0);

  return (
    <>
      <header className="pagehead pagehead--orders">
        <p className="kicker">Pipeline</p>
        <h1>Reorders</h1>
        <p className="sub">
          Refill orders after the kit · {pending.length} pending · {past.length} delivered
          {pendingAmount > 0 ? ` · ${peso(pendingAmount)} to fulfill` : ''}
        </p>
      </header>

      <div className="order-board">
        <div className="order-filters">
          <div className="seg seg--3">
            <button type="button" className={status === 'pending' ? 'is-on' : ''} onClick={() => setStatus('pending')}>
              Pending
            </button>
            <button type="button" className={status === 'past' ? 'is-on' : ''} onClick={() => setStatus('past')}>
              Past
            </button>
            <button type="button" className={status === 'all' ? 'is-on' : ''} onClick={() => setStatus('all')}>
              All
            </button>
          </div>
          <div className="filterbar">
            <FilterMenu
              id="city"
              openId={openMenu}
              setOpenId={setOpenMenu}
              label="City"
              value={city}
              options={cityOptions}
              searchable
              onChange={(next) => {
                setCity(next);
                if (storeId !== 'all') {
                  const selected = stores.find((s) => s.id === storeId);
                  if (next !== 'all' && selected && storeCityName(selected) !== next) setStoreId('all');
                }
              }}
            />
            <FilterMenu
              id="store"
              openId={openMenu}
              setOpenId={setOpenMenu}
              label="Store"
              value={storeId}
              options={storeFilterOptions}
              searchable
              onChange={setStoreId}
            />
            <DateFilter value={orderDate} onChange={setOrderDate} />
            <button
              type="button"
              className={`filterbar__sort${dateSort === 'oldest' ? ' is-asc' : ''}`}
              aria-label={dateSort === 'newest' ? 'Newest first' : 'Oldest first'}
              title={dateSort === 'newest' ? 'Newest first' : 'Oldest first'}
              onClick={() => setDateSort((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
            >
              {dateSort === 'newest' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5h10M11 9h7M11 13h4" />
                  <path d="M5 4v16" />
                  <path d="M5 20l-3.2-3.2M5 20l3.2-3.2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 11h4M11 15h7M11 19h10" />
                  <path d="M5 20V4" />
                  <path d="M5 4l-3.2 3.2M5 4l3.2 3.2" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {visible.length ? (
          <div className="orderlist">
            {visible.map((r) => {
              const p = productById(products, r.product_id);
              const store = stores.find((s) => s.id === r.store_id);
              const pay = parseOrderPay(r.notes);
              const chip = statusChip(pay);
              const qty = Math.max(1, Number(r.quantity) || 1);
              return (
                <article className="orderrow" key={r.id}>
                  <div className="orderrow__top">
                    <div className="t">
                      {p?.name ?? 'Reorder'}
                      {qty > 1 && <span className="qtybadge">×{qty}</span>}
                    </div>
                    <strong className="orderrow__amt">{peso(orderLineTotal(r))}</strong>
                  </div>
                  <div className="orderrow__mid">
                    <button
                      type="button"
                      className="orderrow__store"
                      onClick={() => store && onOpenStore(store)}
                    >
                      {store ? storeDisplayName(store) : 'Store'}
                    </button>
                    <span className={chip.className}>{chip.label}</span>
                  </div>
                  <div className="orderrow__bot">
                    <div className="s">
                      {r.with_container ? 'With container' : 'Refill'} · {tstamp(r.created_at)}
                    </div>
                    <div className="orderrow__acts">
                      <button className="orderrow__act" type="button" onClick={() => setView(r)}>
                        View
                      </button>
                      {pay.deliveredOn === null ? (
                        <button
                          className="orderrow__act"
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirm(r)}
                        >
                          Delivered
                        </button>
                      ) : null}
                      {onDelete ? (
                        <button
                          className="orderrow__act orderrow__act--danger"
                          type="button"
                          disabled={busy}
                          onClick={() => setRemove(r)}
                        >
                          Delete
                        </button>
                      ) : pay.deliveredOn !== null ? (
                        <span className="orderrow__by">{r.logged_by_name || 'Delivered'}</span>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty
            msg={
              city !== 'all' || storeId !== 'all' || orderDate
                ? 'No orders match these filters.'
                : status === 'past'
                  ? 'No delivered orders yet.'
                  : status === 'pending'
                    ? 'No pending orders.'
                    : 'No reorders logged yet.'
            }
          />
        )}

        {tally.length > 0 && (
          <details className="order-tally">
            <summary>
              By product
              <span>{lineCount === 1 ? '1 line' : `${lineCount} lines`}</span>
            </summary>
            {food.length > 0 && <TallyGroup heading="Food" rows={food} />}
            {nonfood.length > 0 && <TallyGroup heading="Non-food" rows={nonfood} />}
          </details>
        )}
      </div>

      {view && (
        <OrderDetail
          order={view}
          store={stores.find((s) => s.id === view.store_id) ?? null}
          product={productById(products, view.product_id)}
          collections={payments.filter((p) => p.store_id === view.store_id && isInstallmentTag(p))}
          busy={busy}
          canDelete={Boolean(onDelete)}
          onClose={() => setView(null)}
          onOpenStore={() => {
            const store = stores.find((s) => s.id === view.store_id);
            setView(null);
            if (store) onOpenStore(store);
          }}
          onDeliver={
            parseOrderPay(view.notes).deliveredOn === null
              ? () => {
                  setView(null);
                  setConfirm(view);
                }
              : undefined
          }
          onDelete={
            onDelete
              ? () => {
                  setView(null);
                  setRemove(view);
                }
              : undefined
          }
        />
      )}

      {remove && onDelete && (
        <ConfirmModal
          kicker="Delete reorder"
          title="Are you sure?"
          message={`This permanently removes ${productById(products, remove.product_id)?.name ?? 'this reorder'}${Number(remove.quantity) > 1 ? ` ×${remove.quantity}` : ''} for ${(() => {
            const store = stores.find((s) => s.id === remove.store_id);
            return store ? storeDisplayName(store) : 'this store';
          })()}. This cannot be undone.`}
          confirmLabel="Delete reorder"
          danger
          busy={busy}
          onClose={() => setRemove(null)}
          onConfirm={() => {
            const row = remove;
            setRemove(null);
            onDelete(row);
          }}
        />
      )}

      {confirm && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Tag delivered">
          <button
            className="modal__scrim"
            type="button"
            aria-label="Cancel"
            onClick={() => !busy && setConfirm(null)}
          />
          <div className="modal__card">
            <header className="modal__head">
              <p className="kicker">Tag delivered</p>
              <h3>Are you sure?</h3>
              <p className="sub">
                Mark {productById(products, confirm.product_id)?.name ?? 'this order'} for{' '}
                {stores.find((s) => s.id === confirm.store_id)?.name ?? 'this store'} as delivered.
              </p>
            </header>
            <div className="modal__actions">
              <button className="btn-ghost" type="button" disabled={busy} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy}
                onClick={() => {
                  const row = confirm;
                  setConfirm(null);
                  onMarkDelivered(row);
                }}
              >
                {busy ? 'Saving…' : 'Confirm delivered'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OrderDetail({
  order,
  store,
  product,
  collections,
  busy,
  canDelete,
  onClose,
  onOpenStore,
  onDeliver,
  onDelete,
}: {
  order: Collection;
  store: Store | null;
  product?: Product;
  collections: Payment[];
  busy: boolean;
  canDelete: boolean;
  onClose: () => void;
  onOpenStore: () => void;
  onDeliver?: () => void;
  onDelete?: () => void;
}) {
  const pay = parseOrderPay(order.notes);
  const chip = statusChip(pay);
  const qty = Math.max(1, Number(order.quantity) || 1);
  const paid = collections.slice().sort((a, b) => (b.paid_on || '').localeCompare(a.paid_on || ''));

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Refill order">
      <button className="modal__scrim" type="button" aria-label="Close" onClick={onClose} />
      <div className="modal__card modal__card--form">
        <header className="modal__head">
          <p className="kicker">{order.is_reorder ? 'Refill' : 'Order'}</p>
          <h3>{product?.name ?? 'Order'}</h3>
          <p className="sub">{store ? storeDisplayName(store) : 'Store'} · {chip.label}</p>
        </header>
        <dl className="modal__facts">
          <div>
            <dt>Store</dt>
            <dd>
              <button type="button" className="orderrow__store" onClick={onOpenStore}>
                {store ? storeDisplayName(store) : 'Open store'}
              </button>
            </dd>
          </div>
          <div>
            <dt>Product</dt>
            <dd>{product?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{order.with_container ? 'With container' : 'Refill only'}{order.is_reorder ? ' · Reorder' : ''}</dd>
          </div>
          <div>
            <dt>Quantity</dt>
            <dd>×{qty}</dd>
          </div>
          <div>
            <dt>Unit price</dt>
            <dd>{order.unit_price != null ? peso(order.unit_price) : '—'}</dd>
          </div>
          <div>
            <dt>Line total</dt>
            <dd>{peso(orderLineTotal(order))}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{chip.label}</dd>
          </div>
          {pay.method && (
            <div>
              <dt>Paid</dt>
              <dd>{pay.method}{pay.paidOn ? ` · ${shortDay(pay.paidOn)}` : ''}</dd>
            </div>
          )}
          {pay.dueOn && (
            <div>
              <dt>Due</dt>
              <dd>{shortDay(pay.dueOn)}</dd>
            </div>
          )}
          <div>
            <dt>Logged</dt>
            <dd>{tstamp(order.created_at)}</dd>
          </div>
          <div>
            <dt>By</dt>
            <dd>{[order.logged_by_name, order.logged_by_role].filter(Boolean).join(' · ') || '—'}</dd>
          </div>
          {order.notes?.trim() ? (
            <div>
              <dt>Notes</dt>
              <dd>{order.notes}</dd>
            </div>
          ) : null}
        </dl>

        <p className="modal__label">Kit collections (₱550)</p>
        {paid.length ? (
          <dl className="modal__facts">
            {paid.map((p) => (
              <div key={p.id}>
                <dt>{(p.paid_on || '').slice(0, 10) || '—'}</dt>
                <dd>
                  {peso(p.amount)}
                  {p.logged_by_name ? ` · ${p.logged_by_name}` : ''}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="sub">No ₱550 kit payments tagged on this store yet.</p>
        )}

        <div className="modal__actions">
          {canDelete && onDelete ? (
            <button className="btn btn-danger" type="button" disabled={busy} onClick={onDelete}>
              Delete
            </button>
          ) : null}
          <button className="btn-ghost" type="button" onClick={onClose}>
            Close
          </button>
          {onDeliver ? (
            <button className="btn btn-primary" type="button" disabled={busy} onClick={onDeliver}>
              Mark delivered
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DateFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker();
        return;
      }
    } catch {
      /* fall through */
    }
    el.focus();
    el.click();
  };

  return (
    <div className={`filterbar__cal${value ? ' is-on' : ''}`}>
      <div className="filterbar__calhit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
        </svg>
        {value ? <span>{shortDay(value)}</span> : null}
        <input
          ref={inputRef}
          className="filterbar__dateinput"
          type="date"
          value={value}
          aria-label="Filter by order date"
          onChange={(e) => onChange(e.target.value)}
          onClick={openPicker}
        />
      </div>
      {value ? (
        <button type="button" className="filterbar__clear" aria-label="Clear date" onClick={() => onChange('')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function TallyGroup({ heading, rows }: { heading: string; rows: ReturnType<typeof reorderTally> }) {
  return (
    <div className="tally">
      <div className="plist__group">{heading}</div>
      {rows.map((r) => (
        <div className="tally__row" key={r.id}>
          <div>
            <div className="t">{r.name}</div>
            <div className="s">
              {r.refill} refill · {r.container} with container
            </div>
          </div>
          <div className="tally__n">
            <strong>{r.count}</strong>
            <span>{peso(r.amount)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
