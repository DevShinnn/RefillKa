'use client';

import { useMemo, useState } from 'react';
import { persistStore } from '@/app/ops/actions';
import { createClient } from '@/lib/supabase/client';
import { useCollections } from '@/lib/hooks/useCollections';
import {
  productById,
  productPrice,
  type Product,
  type Profile,
  type Store,
} from '@/lib/types';
import { fmt, peso, timeAgo, isToday } from '@/lib/format';
import { Topbar } from './Topbar';
import { ProductCatalog } from './ProductCatalog';
import { Kpi, Empty, toast } from './ui';

export function LogClient({
  profile,
  scope,
  stores,
  products,
  initial,
  embedded = false,
}: {
  profile: Profile;
  scope: string;
  stores: Store[];
  products: Product[];
  initial: any[];
  embedded?: boolean;
}) {
  const { rows, status } = useCollections(initial);
  const supabase = useMemo(() => createClient(), []);

  const [storeId, setStoreId] = useState<string>(stores[0]?.id ?? '');
  const [productId, setProductId] = useState('');
  const [withContainer, setWithContainer] = useState(false);
  const [isReorder, setIsReorder] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = productById(products, productId);
  const unitPrice = selected ? productPrice(selected, withContainer) : 0;
  const qtyNum = parseFloat(quantity);
  const lineTotal = (qtyNum > 0 ? qtyNum : 0) * unitPrice;

  const mine = useMemo(
    () => rows.filter((r) => r.logged_by === profile.id),
    [rows, profile.id]
  );
  const todayCount = mine.filter((r) => isToday(r.created_at)).length;
  const gallonsMine = mine
    .filter((r) => r.product_id || r.material === 'refill')
    .reduce((a, r) => a + Number(r.quantity), 0);
  const reorderMine = mine.filter((r) => r.is_reorder).length;

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? '';

  const pickPrice = (id: string, container: boolean) => {
    setProductId(id);
    setWithContainer(container);
  };

  const tagReorder = (id: string) => {
    if (productId === id) {
      setIsReorder((v) => !v);
      return;
    }
    setProductId(id);
    setWithContainer(false);
    setIsReorder(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    const product = productById(products, productId);
    if (!storeId) return toast('No store selected');
    if (!product) return toast('Choose a product from the list');
    if (!(qty > 0)) return toast('Enter a quantity');

    const price = productPrice(product, withContainer);
    setBusy(true);
    const { error } = await supabase.from('collections').insert({
      store_id: storeId,
      material: 'refill',
      quantity: qty,
      unit: 'gal',
      notes: notes.trim(),
      product_id: product.id,
      with_container: withContainer,
      is_reorder: isReorder,
      unit_price: price,
      logged_by: profile.id,
      logged_by_role: profile.role,
    });
    setBusy(false);
    if (error) {
      toast('Save failed — check your access');
      return;
    }
    if (isReorder) {
      const store = stores.find((s) => s.id === storeId);
      if (store) await persistStore({ id: store.id, lguId: store.lgu_id, willReorder: true, patch: {} });
    }
    setQuantity('1');
    setNotes('');
    setIsReorder(false);
    toast(isReorder ? 'Reorder tagged' : 'Order logged');
  };

  const body = (
      <>
        {!embedded && (
        <div className="viewhead">
          <div>
            <h1>Log refill order</h1>
            <p className="sub">
              Choose the product from the RefillKa list. Tap a price, then tag the row if the
              customer is reordering.
            </p>
          </div>
        </div>
        )}

        {!embedded && (
        <div className="kpis">
          <Kpi label="My orders today" value={todayCount} unit={`${mine.length} total logged`} accent="var(--green)" />
          <Kpi label="Gallons logged (mine)" value={fmt(gallonsMine)} unit="from my entries" accent="var(--blue)" />
          <Kpi label="Reorders tagged" value={reorderMine} unit="repeat customers" accent="var(--red)" />
        </div>
        )}

        <form onSubmit={submit}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card__b">
              <div className="formgrid logmeta" style={{ gridTemplateColumns: '1fr 140px 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Store / source</label>
                  <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.barangay}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Gallons</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Notes (optional)</label>
                  <input
                    className="input"
                    placeholder="customer name or remark"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__b">
              <ProductCatalog
                products={products}
                selectedId={productId}
                withContainer={withContainer}
                isReorder={isReorder}
                onPickPrice={pickPrice}
                onTagReorder={tagReorder}
              />
              {selected && (
                <p className="pricehint" style={{ textAlign: 'center', marginTop: 14 }}>
                  {selected.name} · {withContainer ? 'with container' : 'price refill'} ·{' '}
                  {isReorder ? 'tagged reorder' : 'new / first fill'} · {fmt(qtyNum > 0 ? qtyNum : 0)} gal ={' '}
                  <strong>{peso(lineTotal)}</strong>
                </p>
              )}
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 16 }}>
                {busy ? 'Logging…' : isReorder ? '＋ Log reorder' : '＋ Log order'}
              </button>
            </div>
          </div>
        </form>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card__h">
            <h3>My recent orders</h3>
            <span className="tag">{mine.length}</span>
          </div>
          <div className="card__b" style={{ paddingTop: 8 }}>
            {mine.length ? (
              <div className="recent">
                {mine.slice(0, 9).map((r) => {
                  const p = productById(products, r.product_id);
                  return (
                    <div className="item" key={r.id}>
                      <span className="swatch" style={{ background: p?.category === 'food' ? 'var(--yellow)' : 'var(--blue)' }} />
                      <div className="meta">
                        <div className="t">{p?.name ?? 'Refill'}</div>
                        <div className="s">
                          {storeName(r.store_id)} · {r.with_container ? 'with container' : 'refill'}
                          {r.is_reorder ? ' · reorder' : ''} · {timeAgo(r.created_at)}
                        </div>
                      </div>
                      <div className="num" style={{ fontSize: '.9rem' }}>
                        {fmt(r.quantity)}{' '}
                        <span style={{ color: 'var(--light)', fontWeight: 400, fontSize: '.78rem' }}>gal</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty msg="No orders yet — choose a product from the list." />
            )}
          </div>
        </div>

        {!embedded && (
          <p className="footnote">
            Signed in as <strong>{profile.full_name || 'account'}</strong>
            {profile.officer_id ? ` · ${profile.officer_id}` : ''} · {scope} · RefillKa pre-pilot
          </p>
        )}
      </>
  );

  if (embedded) return body;

  return (
    <div className="app">
      <Topbar role={profile.role} name={profile.full_name || 'CENRO staff'} meta={scope} officerId={profile.officer_id} status={status} />
      <main className="main">{body}</main>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '.76rem',
  fontWeight: 600,
  color: 'var(--mid)',
  marginBottom: 6,
};
