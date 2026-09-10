'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { peso } from '@/lib/format';
import type { Collection, Product, ProductCategory } from '@/lib/types';
import { ConfirmModal } from './ConfirmModal';
import { FormModal } from './FormModal';
import { Empty, toast } from './ui';

type Draft = {
  name: string;
  category: ProductCategory;
  packQty: string;
  priceRefill: string;
  priceContainer: string;
  sortOrder: string;
  active: boolean;
};

function draftFrom(p: Product): Draft {
  return {
    name: p.name,
    category: p.category,
    packQty: p.pack_qty,
    priceRefill: String(p.price_refill),
    priceContainer: String(p.price_with_container),
    sortOrder: String(p.sort_order),
    active: p.active !== false,
  };
}

function blankDraft(sortOrder: number): Draft {
  return {
    name: '',
    category: 'food',
    packQty: '1 gallon',
    priceRefill: '',
    priceContainer: '',
    sortOrder: String(sortOrder),
    active: true,
  };
}

export function OpsInventoryPanel({
  products,
  busy,
  setBusy,
  onChange,
  orders = [],
}: {
  products: Product[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onChange: (next: Product[]) => void;
  orders?: Collection[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | 'new' | null>(null);
  const nextSort = (products.reduce((max, p) => Math.max(max, p.sort_order || 0), 0) || 0) + 10;
  const [draft, setDraft] = useState<Draft>(blankDraft(nextSort));
  const [prompt, setPrompt] = useState<'delete' | 'blocked' | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const rows = query
      ? products.filter((p) => [p.name, p.category, p.pack_qty].join(' ').toLowerCase().includes(query))
      : products;
    return rows.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
  }, [products, q]);

  const selected = openId && openId !== 'new' ? products.find((p) => p.id === openId) ?? null : null;
  const usedBy = selected ? orders.filter((o) => o.product_id === selected.id).length : 0;

  const openNew = () => {
    setOpenId('new');
    setDraft(blankDraft(nextSort));
  };

  const openProduct = (p: Product) => {
    setOpenId(p.id);
    setDraft(draftFrom(p));
  };

  const askSave = () => {
    const name = draft.name.trim();
    const refill = Number(draft.priceRefill);
    const container = Number(draft.priceContainer);
    if (!name) return toast('Enter a product name');
    if (!Number.isFinite(refill) || refill < 0) return toast('Enter a refill price');
    if (!Number.isFinite(container) || container < 0) return toast('Enter a container price');
    void save();
  };

  const askDelete = () => {
    if (!selected) return;
    if (usedBy > 0) setPrompt('blocked');
    else setPrompt('delete');
  };

  const save = async () => {
    const name = draft.name.trim();
    const refill = Number(draft.priceRefill);
    const container = Number(draft.priceContainer);
    const sort = Number(draft.sortOrder);
    if (!name) return toast('Enter a product name');
    if (!Number.isFinite(refill) || refill < 0) return toast('Enter a refill price');
    if (!Number.isFinite(container) || container < 0) return toast('Enter a container price');
    const row = {
      name,
      category: draft.category,
      pack_qty: draft.packQty.trim() || '1 gallon',
      price_refill: refill,
      price_with_container: container,
      sort_order: Number.isFinite(sort) ? sort : 0,
      active: draft.active,
    };
    setBusy(true);
    if (openId === 'new') {
      const { data, error } = await supabase.from('products').insert(row).select('*').single();
      setBusy(false);
      setPrompt(null);
      if (error || !data) return toast(error?.message || 'Could not add product');
      const created = data as Product;
      onChange([...products, created]);
      setOpenId(null);
      toast('Product added');
      return;
    }
    if (!selected) {
      setBusy(false);
      setPrompt(null);
      return;
    }
    const { data, error } = await supabase.from('products').update(row).eq('id', selected.id).select('*').single();
    setBusy(false);
    setPrompt(null);
    if (error || !data) return toast(error?.message || 'Could not save product');
    const saved = data as Product;
    onChange(products.map((p) => (p.id === saved.id ? saved : p)));
    setOpenId(null);
    toast('Product updated');
  };

  const remove = async () => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.from('products').delete().eq('id', selected.id);
    setBusy(false);
    setPrompt(null);
    if (error) return toast(error.message || 'Could not delete product');
    onChange(products.filter((p) => p.id !== selected.id));
    setOpenId(null);
    toast('Product deleted');
  };

  return (
    <>
      <header className="pagehead pagehead--split">
        <div>
          <p className="kicker">Catalog</p>
          <h1>Inventory</h1>
          <p className="sub">Refill and container prices used on reorders. Inactive products stay in the database but drop out of the field catalog.</p>
        </div>
        <button type="button" className="btn btn-primary pagehead__save" onClick={openNew}>
          + Add product
        </button>
      </header>

      <section className="sheet">
        <header className="sheet__h sheet__h--row">
          <div>
            <h3>Products</h3>
            <p className="sub">{products.filter((p) => p.active !== false).length} active · {products.length} total · click Edit to change</p>
          </div>
          <div className="ops-toolbar">
            <label className="search">
              <span className="sr">Search products</span>
              <input className="input" value={q} placeholder="Search product" onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
        </header>
        {filtered.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Refill</th>
                  <th>Container</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={openId === p.id ? 'is-on' : ''} onClick={() => openProduct(p)}>
                    <td>
                      {p.name}
                      <div className="s">{p.category === 'food' ? 'Food' : 'Non-food'} · {p.pack_qty}</div>
                    </td>
                    <td className="num">{peso(p.price_refill)}</td>
                    <td className="num">{peso(p.price_with_container)}</td>
                    <td>{p.active === false ? 'Inactive' : 'Active'}</td>
                    <td className="ops-edit">
                      <button type="button" className="btn-row" onClick={(e) => { e.stopPropagation(); openProduct(p); }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty msg="No products yet." />
        )}
      </section>

      {openId && (
        <FormModal
          kicker={openId === 'new' ? 'Create' : 'Edit'}
          title={openId === 'new' ? 'Add product' : selected?.name || 'Product'}
          message="These prices show on the field reorder cart."
          confirmLabel={openId === 'new' ? 'Add product' : 'Save product'}
          dangerLabel={selected ? 'Delete' : undefined}
          busy={busy}
          locked={Boolean(prompt)}
          onClose={() => setOpenId(null)}
          onConfirm={askSave}
          onDanger={selected ? askDelete : undefined}
        >
          <label className="field">
            <span>Name</span>
            <input className="input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </label>
          <label className="field">
            <span>Category</span>
            <select className="input" value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as ProductCategory }))}>
              <option value="food">Food</option>
              <option value="nonfood">Non-food</option>
            </select>
          </label>
          <label className="field">
            <span>Pack</span>
            <input className="input" value={draft.packQty} onChange={(e) => setDraft((d) => ({ ...d, packQty: e.target.value }))} />
          </label>
          <div className="row2">
            <label className="field">
              <span>Refill ₱</span>
              <input className="input" inputMode="decimal" value={draft.priceRefill} onChange={(e) => setDraft((d) => ({ ...d, priceRefill: e.target.value }))} />
            </label>
            <label className="field">
              <span>With container ₱</span>
              <input className="input" inputMode="decimal" value={draft.priceContainer} onChange={(e) => setDraft((d) => ({ ...d, priceContainer: e.target.value }))} />
            </label>
          </div>
          <label className="field">
            <span>Sort order</span>
            <input className="input" inputMode="numeric" value={draft.sortOrder} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))} />
          </label>
          <label className="dev-check">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
            Active in field catalog
          </label>
        </FormModal>
      )}

      {prompt === 'delete' && selected && (
        <ConfirmModal
          kicker="Delete product"
          title="Are you sure?"
          message={`${selected.name} is not used on any reorder. This permanently removes it.`}
          confirmLabel="Delete product"
          danger
          busy={busy}
          onClose={() => setPrompt(null)}
          onConfirm={remove}
        />
      )}
      {prompt === 'blocked' && selected && (
        <ConfirmModal
          kicker="Cannot delete"
          title="This product is in use"
          message={`${selected.name} is on ${usedBy} reorder${usedBy === 1 ? '' : 's'}. Remove those rows in Database first.`}
          blocked
          onClose={() => setPrompt(null)}
        />
      )}
    </>
  );
}
