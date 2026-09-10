'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createAccount, deleteAccount, getAccountUsage, updateAccount } from '@/app/ops/actions';
import { manilaYmd, peso, tstamp } from '@/lib/format';
import { fridayWeekStart, INSTALLMENT_WEEKS, planPaidCount } from '@/lib/installments';
import { normalizeOfficerId } from '@/lib/loginId';
import { usageLines, usageTotal } from '@/lib/opsUsage';
import { ASSIGNABLE_ROLES, ROLE_LABEL, roleNeedsLgu, roleNeedsRegion, type Role } from '@/lib/roles';
import { storeDisplayName } from '@/lib/storeProfile';
import {
  MATERIALS,
  WEEKLY_INSTALLMENT,
  type Collection,
  type Lgu,
  type MaterialId,
  type Payment,
  type Product,
  type ProductCategory,
  type Profile,
  type Region,
  type Store,
} from '@/lib/types';
import { ConfirmModal } from './ConfirmModal';
import { FormModal } from './FormModal';
import { toast } from './ui';

type DbTab = 'stores' | 'payments' | 'collections' | 'profiles' | 'products';
type Prompt = 'delete' | 'blocked' | null;

export function OpsDatabasePanel({
  profile,
  stores,
  payments,
  orders,
  accounts,
  products,
  lgus,
  regions,
  busy,
  setBusy,
  onStores,
  onPayments,
  onOrders,
  onAccounts,
  onProducts,
}: {
  profile: Profile;
  stores: Store[];
  payments: Payment[];
  orders: Collection[];
  accounts: Profile[];
  products: Product[];
  lgus: Lgu[];
  regions: Region[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onStores: (next: Store[]) => void;
  onPayments: (next: Payment[]) => void;
  onOrders: (next: Collection[]) => void;
  onAccounts: (next: Profile[]) => void;
  onProducts: (next: Product[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<DbTab>('stores');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | 'new' | null>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [blockLines, setBlockLines] = useState<string[]>([]);
  const [storeDraft, setStoreDraft] = useState({
    name: '',
    first_name: '',
    last_name: '',
    phone: '',
    city: 'Taguig',
    barangay: '',
    pay_plan: 'installment',
    classification: 'sari_sari',
    lgu_id: profile.lgu_id || lgus[0]?.id || '',
    active: true,
  });
  const [payDraft, setPayDraft] = useState({
    store_id: stores[0]?.id || '',
    amount: String(WEEKLY_INSTALLMENT),
    paid_on: manilaYmd(),
    week_start: fridayWeekStart(manilaYmd()),
    notes: '',
  });
  const [colDraft, setColDraft] = useState({
    store_id: stores[0]?.id || '',
    material: 'refill' as MaterialId,
    quantity: '1',
    notes: '',
    is_reorder: false,
    product_id: '',
    unit_price: '',
  });
  const [userDraft, setUserDraft] = useState({
    officerId: '',
    fullName: '',
    role: 'cenro' as Role,
    lguId: profile.lgu_id || lgus[0]?.id || '',
    regionId: regions[0]?.id || '',
    pin: '',
  });
  const [prodDraft, setProdDraft] = useState({
    name: '',
    category: 'food' as ProductCategory,
    pack_qty: '1 gallon',
    price_refill: '',
    price_with_container: '',
    sort_order: '10',
    active: true,
  });

  const query = q.trim().toLowerCase();
  const hit = (parts: unknown[]) => !query || parts.join(' ').toLowerCase().includes(query);
  const storeName = (id: string) => {
    const s = stores.find((x) => x.id === id);
    return s ? storeDisplayName(s) : id.slice(0, 8);
  };
  const defaultLgu = profile.lgu_id || lgus.find((l) => l.name === 'Taguig')?.id || lgus[0]?.id || '';

  const tables: { id: DbTab; label: string; count: number }[] = [
    { id: 'stores', label: 'Stores', count: stores.length },
    { id: 'payments', label: 'Collections', count: payments.length },
    { id: 'collections', label: 'Orders', count: orders.length },
    { id: 'profiles', label: 'Profiles', count: accounts.length },
    { id: 'products', label: 'Products', count: products.length },
  ];

  const switchTab = (next: DbTab) => {
    setTab(next);
    setQ('');
    setOpenId(null);
    setPrompt(null);
  };

  const selectedStore = openId && openId !== 'new' && tab === 'stores' ? stores.find((s) => s.id === openId) ?? null : null;
  const selectedPay = openId && openId !== 'new' && tab === 'payments' ? payments.find((p) => p.id === openId) ?? null : null;
  const selectedCol = openId && openId !== 'new' && tab === 'collections' ? orders.find((c) => c.id === openId) ?? null : null;
  const selectedUser = openId && openId !== 'new' && tab === 'profiles' ? accounts.find((a) => a.id === openId) ?? null : null;
  const selectedProd = openId && openId !== 'new' && tab === 'products' ? products.find((p) => p.id === openId) ?? null : null;

  const openNew = () => {
    setOpenId('new');
    if (tab === 'stores') {
      setStoreDraft({
        name: '',
        first_name: '',
        last_name: '',
        phone: '',
        city: 'Taguig',
        barangay: '',
        pay_plan: 'installment',
        classification: 'sari_sari',
        lgu_id: defaultLgu,
        active: true,
      });
    } else if (tab === 'payments') {
      setPayDraft({
        store_id: stores[0]?.id || '',
        amount: String(WEEKLY_INSTALLMENT),
        paid_on: manilaYmd(),
        week_start: fridayWeekStart(manilaYmd()),
        notes: '',
      });
    } else if (tab === 'collections') {
      setColDraft({
        store_id: stores[0]?.id || '',
        material: 'refill',
        quantity: '1',
        notes: '',
        is_reorder: false,
        product_id: '',
        unit_price: '',
      });
    } else if (tab === 'profiles') {
      setUserDraft({
        officerId: '',
        fullName: '',
        role: 'cenro',
        lguId: defaultLgu,
        regionId: regions[0]?.id || '',
        pin: '',
      });
    } else {
      setProdDraft({
        name: '',
        category: 'food',
        pack_qty: '1 gallon',
        price_refill: '',
        price_with_container: '',
        sort_order: String((products.reduce((m, p) => Math.max(m, p.sort_order || 0), 0) || 0) + 10),
        active: true,
      });
    }
  };

  const openStore = (s: Store) => {
    setOpenId(s.id);
    setStoreDraft({
      name: s.name ?? '',
      first_name: s.first_name ?? '',
      last_name: s.last_name ?? '',
      phone: s.phone ?? '',
      city: s.city || 'Taguig',
      barangay: s.barangay && s.barangay !== '—' ? s.barangay : '',
      pay_plan: s.pay_plan === 'fully_paid' ? 'fully_paid' : 'installment',
      classification: s.classification === 'independent_reseller' ? 'independent_reseller' : 'sari_sari',
      lgu_id: s.lgu_id,
      active: s.active !== false,
    });
  };
  const openPay = (p: Payment) => {
    setOpenId(p.id);
    setPayDraft({
      store_id: p.store_id,
      amount: String(p.amount),
      paid_on: (p.paid_on || '').slice(0, 10),
      week_start: (p.week_start || '').slice(0, 10),
      notes: p.notes || '',
    });
  };
  const openCol = (c: Collection) => {
    setOpenId(c.id);
    setColDraft({
      store_id: c.store_id,
      material: c.material,
      quantity: String(c.quantity),
      notes: c.notes || '',
      is_reorder: Boolean(c.is_reorder),
      product_id: c.product_id || '',
      unit_price: c.unit_price != null ? String(c.unit_price) : '',
    });
  };
  const openUser = (a: Profile) => {
    setOpenId(a.id);
    setUserDraft({
      officerId: a.officer_id || '',
      fullName: a.full_name || '',
      role: a.role,
      lguId: a.lgu_id || '',
      regionId: a.region_id || '',
      pin: '',
    });
  };
  const openProd = (p: Product) => {
    setOpenId(p.id);
    setProdDraft({
      name: p.name,
      category: p.category,
      pack_qty: p.pack_qty,
      price_refill: String(p.price_refill),
      price_with_container: String(p.price_with_container),
      sort_order: String(p.sort_order),
      active: p.active !== false,
    });
  };

  const askSave = () => {
    if (tab === 'profiles' && openId === 'new' && !/^\d{6}$/.test(userDraft.pin)) return toast('PIN must be 6 digits');
    if (tab === 'stores' && (!storeDraft.first_name.trim() || !storeDraft.last_name.trim())) return toast('Enter first and last name');
    if (tab === 'products' && !prodDraft.name.trim()) return toast('Enter a product name');
    void save();
  };

  const askDelete = async () => {
    if (openId === 'new' || !openId) return;
    if (tab === 'profiles' && selectedUser) {
      if (selectedUser.id === profile.id) return toast('You cannot delete your own login');
      setBusy(true);
      const result = await getAccountUsage(selectedUser.id);
      setBusy(false);
      if (result.error || !result.usage) return toast(result.error || 'Could not check this login');
      const lines = usageLines(result.usage);
      if (usageTotal(result.usage) > 0) {
        setBlockLines(lines);
        setPrompt('blocked');
        return;
      }
    }
    if (tab === 'stores' && selectedStore) {
      const nC = orders.filter((o) => o.store_id === selectedStore.id).length;
      const nP = payments.filter((p) => p.store_id === selectedStore.id).length;
      if (nC || nP) {
        setBlockLines([
          ...(nP ? [`${nP} kit collection${nP === 1 ? '' : 's'}`] : []),
          ...(nC ? [`${nC} refill order${nC === 1 ? '' : 's'}`] : []),
        ]);
        setPrompt('blocked');
        return;
      }
    }
    if (tab === 'products' && selectedProd) {
      const n = orders.filter((o) => o.product_id === selectedProd.id).length;
      if (n) {
        setBlockLines([`${n} reorder${n === 1 ? '' : 's'}`]);
        setPrompt('blocked');
        return;
      }
    }
    setPrompt('delete');
  };

  const save = async () => {
    setBusy(true);
    if (tab === 'stores') {
      const row = {
        ...storeDraft,
        barangay: storeDraft.barangay.trim() || '—',
        name: storeDraft.name.trim() || `${storeDraft.first_name} ${storeDraft.last_name}`.trim(),
        channel: storeDraft.classification === 'independent_reseller' ? 'Independent reseller' : 'Sari-sari',
        updated_by: profile.id,
        updated_by_name: profile.full_name || 'Developer',
      };
      if (openId === 'new') {
        const { data, error } = await supabase.from('stores').insert({ ...row, active: storeDraft.active }).select('*').single();
        setBusy(false);
        setPrompt(null);
        if (error || !data) return toast(error?.message || 'Could not add store');
        onStores([...stores, data as Store]);
        setOpenId(null);
        toast('Store added');
        return;
      }
      const { data, error } = await supabase.from('stores').update(row).eq('id', openId).select('*').single();
      setBusy(false);
      setPrompt(null);
      if (error || !data) return toast(error?.message || 'Could not save store');
      onStores(stores.map((s) => (s.id === openId ? (data as Store) : s)));
      setOpenId(null);
      toast('Store updated');
      return;
    }

    if (tab === 'payments') {
      const amount = Number(payDraft.amount);
      if (!payDraft.store_id) {
        setBusy(false);
        setPrompt(null);
        return toast('Pick a store');
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        setBusy(false);
        setPrompt(null);
        return toast('Enter an amount');
      }
      if (openId === 'new') {
        const { data, error } = await supabase
          .from('payments')
          .insert({
            store_id: payDraft.store_id,
            amount,
            paid_on: payDraft.paid_on,
            week_start: payDraft.week_start || fridayWeekStart(payDraft.paid_on),
            notes: payDraft.notes,
            logged_by: profile.id,
          })
          .select('*')
          .single();
        setBusy(false);
        setPrompt(null);
        if (error || !data) return toast(error?.message || 'Could not add collection');
        const nextPays = [data as Payment, ...payments];
        onPayments(nextPays);
        setOpenId(null);
        const store = stores.find((s) => s.id === payDraft.store_id);
        if (store && store.pay_plan !== 'fully_paid' && planPaidCount(nextPays, store.id, store.claimed_on) >= INSTALLMENT_WEEKS) {
          const { data: saved } = await supabase.from('stores').update({ pay_plan: 'fully_paid' }).eq('id', store.id).select('*').single();
          if (saved) onStores(stores.map((s) => (s.id === store.id ? (saved as Store) : s)));
          toast('Collection added · kit complete · fully paid');
        } else {
          toast('Collection added');
        }
        return;
      }
      const { data, error } = await supabase
        .from('payments')
        .update({
          store_id: payDraft.store_id,
          amount,
          paid_on: payDraft.paid_on,
          week_start: payDraft.week_start,
          notes: payDraft.notes,
        })
        .eq('id', openId)
        .select('*')
        .single();
      setBusy(false);
      setPrompt(null);
      if (error || !data) return toast(error?.message || 'Could not save collection');
      const nextPays = payments.map((p) => (p.id === openId ? (data as Payment) : p));
      onPayments(nextPays);
      setOpenId(null);
      const store = stores.find((s) => s.id === payDraft.store_id);
      if (store && store.pay_plan !== 'fully_paid' && planPaidCount(nextPays, store.id, store.claimed_on) >= INSTALLMENT_WEEKS) {
        const { data: saved } = await supabase.from('stores').update({ pay_plan: 'fully_paid' }).eq('id', store.id).select('*').single();
        if (saved) onStores(stores.map((s) => (s.id === store.id ? (saved as Store) : s)));
        toast('Collection updated · kit complete · fully paid');
      } else {
        toast('Collection updated');
      }
      return;
    }

    if (tab === 'collections') {
      const quantity = Number(colDraft.quantity);
      if (!colDraft.store_id) {
        setBusy(false);
        setPrompt(null);
        return toast('Pick a store');
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setBusy(false);
        setPrompt(null);
        return toast('Enter a quantity');
      }
      const row = {
        store_id: colDraft.store_id,
        material: colDraft.material,
        quantity,
        unit: MATERIALS.find((m) => m.id === colDraft.material)?.unit || '',
        notes: colDraft.notes,
        is_reorder: colDraft.is_reorder,
        product_id: colDraft.product_id || null,
        unit_price: colDraft.unit_price ? Number(colDraft.unit_price) : null,
      };
      if (openId === 'new') {
        const { data, error } = await supabase
          .from('collections')
          .insert({ ...row, logged_by: profile.id, collected_at: new Date().toISOString() })
          .select('*')
          .single();
        setBusy(false);
        setPrompt(null);
        if (error || !data) return toast(error?.message || 'Could not add order');
        onOrders([data as Collection, ...orders]);
        setOpenId(null);
        toast('Order added');
        return;
      }
      const { data, error } = await supabase.from('collections').update(row).eq('id', openId).select('*').single();
      setBusy(false);
      setPrompt(null);
      if (error || !data) return toast(error?.message || 'Could not save order');
      onOrders(orders.map((c) => (c.id === openId ? (data as Collection) : c)));
      setOpenId(null);
      toast('Order updated');
      return;
    }

    if (tab === 'profiles') {
      const input = {
        officerId: userDraft.officerId,
        fullName: userDraft.fullName,
        role: userDraft.role,
        lguId: userDraft.lguId || null,
        regionId: userDraft.regionId || null,
      };
      if (openId === 'new') {
        const result = await createAccount({ ...input, pin: userDraft.pin });
        setBusy(false);
        setPrompt(null);
        if (result.error || !result.account) return toast(result.error || 'Could not create account');
        onAccounts([...accounts, result.account]);
        setOpenId(null);
        toast(`Created ${normalizeOfficerId(userDraft.officerId)}`);
        return;
      }
      const result = await updateAccount(openId as string, input);
      setBusy(false);
      setPrompt(null);
      if (result.error || !result.account) return toast(result.error || 'Could not update account');
      onAccounts(accounts.map((a) => (a.id === openId ? result.account! : a)));
      setOpenId(null);
      toast('Account updated');
      return;
    }

    const row = {
      name: prodDraft.name.trim(),
      category: prodDraft.category,
      pack_qty: prodDraft.pack_qty.trim() || '1 gallon',
      price_refill: Number(prodDraft.price_refill),
      price_with_container: Number(prodDraft.price_with_container),
      sort_order: Number(prodDraft.sort_order) || 0,
      active: prodDraft.active,
    };
    if (openId === 'new') {
      const { data, error } = await supabase.from('products').insert(row).select('*').single();
      setBusy(false);
      setPrompt(null);
      if (error || !data) return toast(error?.message || 'Could not add product');
      onProducts([...products, data as Product]);
      setOpenId(null);
      toast('Product added');
      return;
    }
    const { data, error } = await supabase.from('products').update(row).eq('id', openId).select('*').single();
    setBusy(false);
    setPrompt(null);
    if (error || !data) return toast(error?.message || 'Could not save product');
    onProducts(products.map((p) => (p.id === openId ? (data as Product) : p)));
    setOpenId(null);
    toast('Product updated');
  };

  const remove = async () => {
    if (!openId || openId === 'new') return;
    setBusy(true);
    if (tab === 'profiles') {
      const result = await deleteAccount(openId);
      setBusy(false);
      setPrompt(null);
      if (result.error) return toast(result.error);
      onAccounts(accounts.filter((a) => a.id !== openId));
      setOpenId(null);
      toast('Account deleted');
      return;
    }
    const table = tab === 'collections' ? 'collections' : tab;
    const { error } = await supabase.from(table).delete().eq('id', openId);
    setBusy(false);
    setPrompt(null);
    if (error) return toast(error.message || 'Could not delete row');
    if (tab === 'stores') onStores(stores.filter((s) => s.id !== openId));
    if (tab === 'payments') onPayments(payments.filter((p) => p.id !== openId));
    if (tab === 'collections') onOrders(orders.filter((c) => c.id !== openId));
    if (tab === 'products') onProducts(products.filter((p) => p.id !== openId));
    setOpenId(null);
    toast('Row deleted');
  };

  const noun =
    tab === 'stores' ? 'store' :
    tab === 'payments' ? 'collection' :
    tab === 'collections' ? 'order' :
    tab === 'profiles' ? 'account' :
    'product';

  return (
    <>
      <header className="pagehead pagehead--split">
        <div>
          <p className="kicker">Inspect</p>
          <h1>Database</h1>
          <p className="sub">Search a table, then use Add or Edit. Changes open in a modal.</p>
        </div>
        <button type="button" className="btn btn-primary pagehead__save" onClick={openNew}>
          + Add {noun}
        </button>
      </header>
      <div className="ops-dbtabs">
        {tables.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'is-on' : ''} onClick={() => switchTab(t.id)}>
            {t.label}
            <span>{t.count}</span>
          </button>
        ))}
      </div>

      <section className="sheet">
        <header className="sheet__h sheet__h--row">
          <div>
            <h3>{tables.find((t) => t.id === tab)?.label}</h3>
            <p className="sub">Click Edit or a row to change it in a modal.</p>
          </div>
          <div className="ops-toolbar">
            <label className="search">
              <span className="sr">Filter rows</span>
              <input className="input" value={q} placeholder="Filter this table" onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
        </header>
        <div className="tablewrap">
          {tab === 'stores' && (
            <table>
              <thead>
                <tr>
                  <th>RK</th>
                  <th>Store</th>
                  <th>Plan</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stores.filter((s) => hit([s.name, s.store_code, s.arrp_id, s.first_name, s.last_name, s.phone])).map((s) => (
                  <tr key={s.id} className={openId === s.id ? 'is-on' : ''} onClick={() => openStore(s)}>
                    <td>{s.store_code || '—'}</td>
                    <td>{storeDisplayName(s)}</td>
                    <td>{s.pay_plan === 'fully_paid' ? 'Fully paid' : 'Installment'}</td>
                    <td>{s.updated_at ? tstamp(s.updated_at) : tstamp(s.created_at)}</td>
                    <td className="ops-edit">
                      <button type="button" className="btn-row" onClick={(e) => { e.stopPropagation(); openStore(s); }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'payments' && (
            <table>
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.filter((p) => hit([storeName(p.store_id), p.amount, p.notes, p.logged_by_name])).map((p) => (
                  <tr key={p.id} className={openId === p.id ? 'is-on' : ''} onClick={() => openPay(p)}>
                    <td>{storeName(p.store_id)}</td>
                    <td className="num">{peso(p.amount)}</td>
                    <td>{(p.paid_on || '').slice(0, 10)}</td>
                    <td>{p.logged_by_name || '—'}</td>
                    <td className="ops-edit">
                      <button type="button" className="btn-row" onClick={(e) => { e.stopPropagation(); openPay(p); }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'collections' && (
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Store</th>
                  <th>Item</th>
                  <th>By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.filter((c) => hit([storeName(c.store_id), c.material, c.notes, c.logged_by_name])).map((c) => (
                  <tr key={c.id} className={openId === c.id ? 'is-on' : ''} onClick={() => openCol(c)}>
                    <td>{tstamp(c.created_at)}</td>
                    <td>{storeName(c.store_id)}</td>
                    <td>{c.is_reorder ? 'Refill' : c.material}</td>
                    <td>{c.logged_by_name || '—'}</td>
                    <td className="ops-edit">
                      <button type="button" className="btn-row" onClick={(e) => { e.stopPropagation(); openCol(c); }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'profiles' && (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accounts.filter((a) => hit([a.officer_id, a.full_name, a.role, ROLE_LABEL[a.role]])).map((a) => (
                  <tr key={a.id} className={openId === a.id ? 'is-on' : ''} onClick={() => openUser(a)}>
                    <td>{a.officer_id || '—'}</td>
                    <td>{a.full_name || '—'}</td>
                    <td>{ROLE_LABEL[a.role] || a.role}</td>
                    <td className="ops-edit">
                      <button type="button" className="btn-row" onClick={(e) => { e.stopPropagation(); openUser(a); }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'products' && (
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Refill</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.filter((p) => hit([p.name, p.category])).map((p) => (
                  <tr key={p.id} className={openId === p.id ? 'is-on' : ''} onClick={() => openProd(p)}>
                    <td>{p.name}</td>
                    <td className="num">{peso(p.price_refill)}</td>
                    <td>{p.active === false ? 'Inactive' : 'Active'}</td>
                    <td className="ops-edit">
                      <button type="button" className="btn-row" onClick={(e) => { e.stopPropagation(); openProd(p); }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {openId && (
        <FormModal
          wide={tab === 'stores' || tab === 'collections'}
          kicker={openId === 'new' ? 'Create' : 'Edit'}
          title={openId === 'new' ? `Add ${noun}` : `Edit ${noun}`}
          confirmLabel={openId === 'new' ? `Add ${noun}` : `Save ${noun}`}
          dangerLabel={openId !== 'new' ? 'Delete' : undefined}
          busy={busy}
          locked={Boolean(prompt)}
          onClose={() => setOpenId(null)}
          onConfirm={askSave}
          onDanger={openId !== 'new' ? askDelete : undefined}
        >
          {tab === 'stores' && (
            <>
              <div className="row2">
                <label className="field"><span>First name</span><input className="input" value={storeDraft.first_name} onChange={(e) => setStoreDraft((d) => ({ ...d, first_name: e.target.value }))} /></label>
                <label className="field"><span>Last name</span><input className="input" value={storeDraft.last_name} onChange={(e) => setStoreDraft((d) => ({ ...d, last_name: e.target.value }))} /></label>
              </div>
              <label className="field"><span>Store name</span><input className="input" value={storeDraft.name} onChange={(e) => setStoreDraft((d) => ({ ...d, name: e.target.value }))} /></label>
              <label className="field"><span>Phone</span><input className="input" value={storeDraft.phone} onChange={(e) => setStoreDraft((d) => ({ ...d, phone: e.target.value }))} /></label>
              <label className="field">
                <span>LGU</span>
                <select className="input" value={storeDraft.lgu_id} onChange={(e) => setStoreDraft((d) => ({ ...d, lgu_id: e.target.value }))}>
                  {lgus.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
              <div className="row2">
                <label className="field"><span>City</span><input className="input" value={storeDraft.city} onChange={(e) => setStoreDraft((d) => ({ ...d, city: e.target.value }))} /></label>
                <label className="field"><span>Barangay</span><input className="input" value={storeDraft.barangay} onChange={(e) => setStoreDraft((d) => ({ ...d, barangay: e.target.value }))} /></label>
              </div>
              <label className="field">
                <span>Plan</span>
                <select className="input" value={storeDraft.pay_plan} onChange={(e) => setStoreDraft((d) => ({ ...d, pay_plan: e.target.value }))}>
                  <option value="installment">Installment</option>
                  <option value="fully_paid">Fully paid</option>
                </select>
              </label>
              <label className="dev-check">
                <input type="checkbox" checked={storeDraft.active} onChange={(e) => setStoreDraft((d) => ({ ...d, active: e.target.checked }))} />
                Active store
              </label>
            </>
          )}

          {tab === 'payments' && (
            <>
              <label className="field">
                <span>Store</span>
                <select className="input" value={payDraft.store_id} onChange={(e) => setPayDraft((d) => ({ ...d, store_id: e.target.value }))}>
                  {stores.map((s) => <option key={s.id} value={s.id}>{storeDisplayName(s)}</option>)}
                </select>
              </label>
              <label className="field"><span>Amount ₱ (kit 550)</span><input className="input" inputMode="decimal" value={payDraft.amount} onChange={(e) => setPayDraft((d) => ({ ...d, amount: e.target.value }))} /></label>
              <div className="row2">
                <label className="field"><span>Paid on</span><input className="input" type="date" value={payDraft.paid_on} onChange={(e) => setPayDraft((d) => ({ ...d, paid_on: e.target.value, week_start: fridayWeekStart(e.target.value) }))} /></label>
                <label className="field"><span>Week start</span><input className="input" type="date" value={payDraft.week_start} onChange={(e) => setPayDraft((d) => ({ ...d, week_start: e.target.value }))} /></label>
              </div>
              <label className="field"><span>Notes</span><input className="input" value={payDraft.notes} onChange={(e) => setPayDraft((d) => ({ ...d, notes: e.target.value }))} /></label>
            </>
          )}

          {tab === 'collections' && (
            <>
              <label className="field">
                <span>Store</span>
                <select className="input" value={colDraft.store_id} onChange={(e) => setColDraft((d) => ({ ...d, store_id: e.target.value }))}>
                  {stores.map((s) => <option key={s.id} value={s.id}>{storeDisplayName(s)}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Material</span>
                <select className="input" value={colDraft.material} onChange={(e) => setColDraft((d) => ({ ...d, material: e.target.value as MaterialId }))}>
                  {MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
              <label className="field"><span>Quantity</span><input className="input" inputMode="decimal" value={colDraft.quantity} onChange={(e) => setColDraft((d) => ({ ...d, quantity: e.target.value }))} /></label>
              <label className="field">
                <span>Product (reorders)</span>
                <select className="input" value={colDraft.product_id} onChange={(e) => setColDraft((d) => ({ ...d, product_id: e.target.value }))}>
                  <option value="">None</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="field"><span>Unit price</span><input className="input" inputMode="decimal" value={colDraft.unit_price} onChange={(e) => setColDraft((d) => ({ ...d, unit_price: e.target.value }))} /></label>
              <label className="dev-check">
                <input type="checkbox" checked={colDraft.is_reorder} onChange={(e) => setColDraft((d) => ({ ...d, is_reorder: e.target.checked }))} />
                Reorder
              </label>
              <label className="field"><span>Notes</span><input className="input" value={colDraft.notes} onChange={(e) => setColDraft((d) => ({ ...d, notes: e.target.value }))} /></label>
            </>
          )}

          {tab === 'profiles' && (
            <>
              <label className="field"><span>Login ID</span><input className="input" value={userDraft.officerId} onChange={(e) => setUserDraft((d) => ({ ...d, officerId: e.target.value.toUpperCase() }))} /></label>
              <label className="field"><span>Full name</span><input className="input" value={userDraft.fullName} onChange={(e) => setUserDraft((d) => ({ ...d, fullName: e.target.value }))} /></label>
              <label className="field">
                <span>Role</span>
                <select className="input" value={userDraft.role} onChange={(e) => setUserDraft((d) => ({ ...d, role: e.target.value as Role }))}>
                  {ASSIGNABLE_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
                </select>
              </label>
              {roleNeedsLgu(userDraft.role) && (
                <label className="field">
                  <span>LGU</span>
                  <select className="input" value={userDraft.lguId} onChange={(e) => setUserDraft((d) => ({ ...d, lguId: e.target.value }))}>
                    {lgus.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </label>
              )}
              {roleNeedsRegion(userDraft.role) && (
                <label className="field">
                  <span>Region</span>
                  <select className="input" value={userDraft.regionId} onChange={(e) => setUserDraft((d) => ({ ...d, regionId: e.target.value }))}>
                    {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
              )}
              {openId === 'new' && (
                <label className="field"><span>PIN (6 digits)</span><input className="input" inputMode="numeric" maxLength={6} value={userDraft.pin} onChange={(e) => setUserDraft((d) => ({ ...d, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} /></label>
              )}
            </>
          )}

          {tab === 'products' && (
            <>
              <label className="field"><span>Name</span><input className="input" value={prodDraft.name} onChange={(e) => setProdDraft((d) => ({ ...d, name: e.target.value }))} /></label>
              <label className="field">
                <span>Category</span>
                <select className="input" value={prodDraft.category} onChange={(e) => setProdDraft((d) => ({ ...d, category: e.target.value as ProductCategory }))}>
                  <option value="food">Food</option>
                  <option value="nonfood">Non-food</option>
                </select>
              </label>
              <div className="row2">
                <label className="field"><span>Refill ₱</span><input className="input" value={prodDraft.price_refill} onChange={(e) => setProdDraft((d) => ({ ...d, price_refill: e.target.value }))} /></label>
                <label className="field"><span>Container ₱</span><input className="input" value={prodDraft.price_with_container} onChange={(e) => setProdDraft((d) => ({ ...d, price_with_container: e.target.value }))} /></label>
              </div>
              <label className="dev-check">
                <input type="checkbox" checked={prodDraft.active} onChange={(e) => setProdDraft((d) => ({ ...d, active: e.target.checked }))} />
                Active
              </label>
            </>
          )}
        </FormModal>
      )}

      {prompt === 'delete' && (
        <ConfirmModal
          kicker={`Delete ${noun}`}
          title="Are you sure?"
          message={`This permanently removes the ${noun}. This cannot be undone.`}
          confirmLabel={`Delete ${noun}`}
          danger
          busy={busy}
          onClose={() => setPrompt(null)}
          onConfirm={remove}
        />
      )}
      {prompt === 'blocked' && (
        <ConfirmModal
          kicker="Cannot delete"
          title="Connected data is still attached"
          message="Remove those rows first. Deleting this record would break them."
          blocked
          onClose={() => setPrompt(null)}
        >
          <dl className="modal__facts">
            {blockLines.map((line) => (
              <div key={line}>
                <dt>Attached</dt>
                <dd>{line}</dd>
              </div>
            ))}
          </dl>
        </ConfirmModal>
      )}
    </>
  );
}
