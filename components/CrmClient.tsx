'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { persistStore, persistStoreFeedback, removeStoreFeedback } from '@/app/ops/actions';
import { createClient } from '@/lib/supabase/client';
import { useCollections } from '@/lib/hooks/useCollections';
import { usePayments } from '@/lib/hooks/usePayments';
import { useStoreFeedback } from '@/lib/hooks/useStoreFeedback';
import { repliesFor, useFeedbackReplies } from '@/lib/hooks/useFeedbackReplies';
import {
  WEEKLY_INSTALLMENT,
  productById,
  productPrice,
  type Collection,
  type FeedbackTopic,
  type Payment,
  type Product,
  type Profile,
  type Store,
  type StoreFeedback,
} from '@/lib/types';
import {
  manilaTimeLabel,
  manilaYmd,
  peso,
  tstamp,
} from '@/lib/format';
import {
  INSTALLMENT_WEEKS,
  installmentWeekFor,
  installmentWeeks,
  isInstallmentStore,
  isInstallmentTag,
  paymentForWeek,
  planPaidCount,
  planPendingCount,
  storesDueForFullyPaid,
  weekRangeLabel,
  type InstallmentWeek,
} from '@/lib/installments';
import { isPendingOrder, parseOrderPay, withDelivered, type PayMethod } from '@/lib/orders';
import { isDeveloper } from '@/lib/roles';
import { barangaysForCity, storeCityName } from '@/lib/phPlaces';
import {
  ageFromDob,
  blankStoreForm,
  formFromStore,
  storeDisplayName,
  storeSearchText,
  toStorePatch,
  type StoreForm,
} from '@/lib/storeProfile';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { FilterMenu } from './FilterMenu';
import { ProductCatalog } from './ProductCatalog';
import { ReordersPanel } from './ReordersPanel';
import { FeedbackPanel } from './FeedbackPanel';
import { ReportPanel } from './ReportPanel';
import { StoreProfileForm, StoreProfileView } from './StoreProfile';
import { Empty, toast } from './ui';

type Screen = 'list' | 'new' | 'store';
type Tab = 'stores' | 'reorders' | 'feedback' | 'report';

export function CrmClient({
  profile,
  scope,
  stores: initialStores,
  products,
  orders,
  payments: initialPayments,
}: {
  profile: Profile;
  scope: string;
  stores: Store[];
  products: Product[];
  orders: Collection[];
  payments: Payment[];
}) {
  const { rows: orderRows, status, setRows: setOrderRows } = useCollections(orders);
  const { rows: payRows, setRows: setPayRows } = usePayments(initialPayments);
  const supabase = useMemo(() => createClient(), []);

  const [screen, setScreen] = useState<Screen>('list');
  const [tab, setTab] = useState<Tab>('stores');
  const [navOpen, setNavOpen] = useState(false);
  const reorderCount = orderRows.filter(isPendingOrder).length;
  const canSeeReport = isDeveloper(profile.role);

  const go = (next: Tab) => {
    if (next === 'report' && !canSeeReport) return;
    setTab(next);
    if (window.matchMedia('(max-width: 959px)').matches) setNavOpen(false);
  };

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 960px)');
    const sync = () => setNavOpen(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 959px)').matches;
    document.body.style.overflow = navOpen && mobile ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [navOpen]);
  const [stores, setStores] = useState<Store[]>(initialStores);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editDetails, setEditDetails] = useState(false);
  const [visitDate, setVisitDate] = useState(manilaYmd());
  const [q, setQ] = useState('');
  const [listCity, setListCity] = useState('all');
  const [listBarangay, setListBarangay] = useState('all');

  const [form, setForm] = useState<StoreForm>(blankStoreForm);
  const [willReorder, setWillReorder] = useState('');
  const [placeMenu, setPlaceMenu] = useState<string | null>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [confirmPay, setConfirmPay] = useState<{ week: InstallmentWeek } | null>(null);
  const [payDate, setPayDate] = useState(manilaYmd());
  const [payMethod, setPayMethod] = useState<PayMethod>('Cash');
  const [checkout, setCheckout] = useState<CartLine[] | null>(null);
  const [orderPayWhen, setOrderPayWhen] = useState<'now' | 'later'>('now');
  const [orderDueOn, setOrderDueOn] = useState(manilaYmd());
  const [orderEdit, setOrderEdit] = useState<Collection | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editContainer, setEditContainer] = useState(false);
  const [orderDelete, setOrderDelete] = useState<Collection | null>(null);
  const [feedbackTopic, setFeedbackTopic] = useState<FeedbackTopic>('product');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackDelete, setFeedbackDelete] = useState<StoreFeedback | null>(null);

  const store = stores.find((s) => s.id === openId) ?? null;
  const planWeeks = useMemo(() => installmentWeeks(store?.claimed_on), [store?.claimed_on]);
  const currentWeek = installmentWeekFor(visitDate, store?.claimed_on);
  const storePays = payRows.filter((p) => p.store_id === openId);
  const storeOrders = orderRows.filter((r) => r.store_id === openId);
  const { rows: feedbackRows, setRows: setFeedbackRows } = useStoreFeedback(
    screen === 'store' ? openId : null
  );
  const { rows: feedbackReplies } = useFeedbackReplies();
  const cartTotal = cart.reduce((sum, line) => {
    const product = productById(products, line.productId);
    if (!product) return sum;
    return sum + productPrice(product, line.withContainer) * line.qty;
  }, 0);
  const checkoutTotal = (checkout ?? []).reduce((sum, line) => {
    const product = productById(products, line.productId);
    if (!product) return sum;
    return sum + productPrice(product, line.withContainer) * line.qty;
  }, 0);

  const listCityOptions = useMemo(() => {
    const names = [...new Set(stores.map(storeCityName))].sort((a, b) => a.localeCompare(b));
    return [{ value: 'all', label: 'All cities' }, ...names.map((name) => ({ value: name, label: name }))];
  }, [stores]);

  const listBarangayOptions = useMemo(() => {
    const pool = listCity === 'all' ? stores : stores.filter((s) => storeCityName(s) === listCity);
    const names = [
      ...new Set(
        pool
          .map((s) => (s.barangay && s.barangay !== '—' ? s.barangay.trim() : ''))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
    return [{ value: 'all', label: 'All barangays' }, ...names.map((name) => ({ value: name, label: name }))];
  }, [stores, listCity]);

  const filtered = stores.filter((s) => {
    if (listCity !== 'all' && storeCityName(s) !== listCity) return false;
    if (listBarangay !== 'all' && (s.barangay || '').trim() !== listBarangay) return false;
    return storeSearchText(s).includes(q.trim().toLowerCase());
  });

  const patchForm = (next: Partial<StoreForm>) => {
    setForm((prev) => {
      const merged = { ...prev, ...next };
      if (next.city && prev.barangay && !barangaysForCity(next.city).includes(prev.barangay)) {
        merged.barangay = '';
      }
      if (next.dob) {
        const years = ageFromDob(next.dob);
        if (years != null) merged.age = String(years);
      }
      return merged;
    });
  };

  const fillForm = (s: Store) => {
    setForm(formFromStore(s));
    setWillReorder(s.will_reorder === true ? 'yes' : s.will_reorder === false ? 'no' : '');
  };

  const openStore = (s: Store) => {
    setOpenId(s.id);
    fillForm(s);
    setVisitDate(manilaYmd());
    setEditDetails(false);
    setFeedbackNote('');
    setFeedbackTopic('product');
    setCart([]);
    setCheckout(null);
    setScreen('store');
    setTab('stores');
  };

  const openNew = () => {
    setOpenId(null);
    setForm(blankStoreForm());
    setWillReorder('');
    setCart([]);
    setVisitDate(manilaYmd());
    setScreen('new');
  };

  const saveStore = async (e: FormEvent) => {
    e.preventDefault();
    const patch = toStorePatch(form, profile);
    if (!patch.first_name || !patch.last_name) return toast('Enter first and last name');
    if (!patch.city) return toast('Choose a city');
    if (!patch.phone) return toast('Enter a contact number');
    if (!patch.claimed_on) return toast('Enter the date claimed');
    if (!profile.lgu_id) return toast('Your account has no LGU assigned');
    setBusy(true);

    const result = await persistStore({
      id: screen === 'new' ? null : openId,
      lguId: profile.lgu_id,
      active: screen === 'new' ? true : undefined,
      willReorder: willReorder === '' ? null : willReorder === 'yes',
      patch,
    });
    setBusy(false);
    if (result.error || !result.store) {
      toast(
        /column|schema|classification|arrp|claimed/i.test(result.error || '')
          ? 'Store profile columns are missing. Apply migration 0011_store_profile.sql.'
          : result.error || (screen === 'new' ? 'Could not open store' : 'Could not save details')
      );
      return;
    }
    const saved = result.store;
    if (screen === 'new') {
      setStores((prev) => [...prev, saved].sort((a, b) => storeDisplayName(a).localeCompare(storeDisplayName(b))));
      openStore(saved);
      toast('Store opened');
      return;
    }
    setStores((prev) => prev.map((s) => (s.id === openId ? saved : s)));
    fillForm(saved);
    toast('Details saved');
    setEditDetails(false);
  };

  const cancelEdit = () => {
    if (store) fillForm(store);
    setEditDetails(false);
  };

  const requestTag = (week: InstallmentWeek) => {
    if (!store) return;
    if (paymentForWeek(payRows, store.id, week.start, store.claimed_on)) {
      return toast('Already tagged for that week');
    }
    setPayMethod('Cash');
    setPayDate(manilaYmd());
    setConfirmPay({ week });
  };

  const markFullyPaid = async (target: Store) => {
    const result = await persistStore({ id: target.id, lguId: target.lgu_id, patch: { pay_plan: 'fully_paid' } });
    if (!result.store) return null;
    setStores((prev) => prev.map((s) => (s.id === result.store!.id ? result.store! : s)));
    return result.store;
  };

  const commitPayment = async () => {
    if (!store || !confirmPay) return;
    const { week } = confirmPay;
    const paidOn = payDate;
    if (!paidOn) return toast('Choose the date paid');
    if (paidOn > manilaYmd()) return toast('Payment date cannot be in the future');
    const late = paidOn > week.end;
    setBusy(true);
    const usedWeeks = new Set(
      payRows.filter((p) => p.store_id === store.id && isInstallmentTag(p)).map((p) => (p.week_start || '').slice(0, 10))
    );
    const weekStart =
      usedWeeks.has(week.start)
        ? installmentWeeks(store.claimed_on).find((w) => !usedWeeks.has(w.start))?.start || week.start
        : week.start;
    const { data, error } = await supabase
      .from('payments')
      .insert({
        store_id: store.id,
        amount: WEEKLY_INSTALLMENT,
        paid_on: paidOn,
        week_start: weekStart,
        notes: buildPayNotes(payMethod, paidOn, late),
        logged_by: profile.id,
        logged_by_role: profile.role,
      })
      .select('*')
      .single();
    if (error || !data) {
      setBusy(false);
      toast(/unique|duplicate/i.test(error?.message || '') ? 'Already tagged for that week' : 'Collection failed');
      return;
    }
    const payment = data as Payment;
    const nextPays = [payment, ...payRows.filter((p) => p.id !== payment.id)];
    setPayRows(nextPays);
    const paidCount = planPaidCount(nextPays, store.id, store.claimed_on);
    let finished = false;
    if (paidCount >= INSTALLMENT_WEEKS) {
      finished = Boolean(await markFullyPaid(store));
    }
    setBusy(false);
    setConfirmPay(null);
    toast(
      finished
        ? `Kit complete · 9/9 · fully paid`
        : `Tagged paid${late ? ' (late)' : ''} · ${paidCount}/${INSTALLMENT_WEEKS} · ${payMethod} · ${peso(WEEKLY_INSTALLMENT)}`
    );
  };

  const addToCart = (productId: string, withContainer: boolean) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === productId && l.withContainer === withContainer);
      if (i < 0) return [...prev, { productId, withContainer, qty: 1 }];
      return prev.map((l, idx) => (idx === i ? { ...l, qty: l.qty + 1 } : l));
    });
  };

  const setCartQty = (productId: string, withContainer: boolean, qty: number) => {
    const next = Math.max(0, Math.round(qty || 0));
    setCart((prev) =>
      next < 1
        ? prev.filter((l) => !(l.productId === productId && l.withContainer === withContainer))
        : prev.map((l) => (l.productId === productId && l.withContainer === withContainer ? { ...l, qty: next } : l))
    );
  };

  const requestLogOrder = () => {
    if (!store) return toast('Save the store first');
    if (cart.length === 0) return toast('Add products to the cart first');
    setPayMethod('Cash');
    setOrderPayWhen('now');
    setOrderDueOn(visitDate);
    setCheckout(cart.map((l) => ({ ...l })));
  };

  const commitLogOrder = async () => {
    if (!store || !checkout || checkout.length === 0) return;
    if (orderPayWhen === 'later' && !orderDueOn) return toast('Choose when they will pay');
    const notes =
      orderPayWhen === 'now'
        ? `[${payMethod}] Paid ${visitDate} · ${manilaTimeLabel()}`
        : `[Due ${orderDueOn}] · ${manilaTimeLabel()}`;
    const payload = checkout
      .map((line) => {
        const product = productById(products, line.productId);
        if (!product) return null;
        return {
          store_id: store.id,
          material: 'refill' as const,
          quantity: Math.max(1, line.qty),
          unit: 'gal',
          notes,
          product_id: product.id,
          with_container: line.withContainer,
          is_reorder: true,
          unit_price: productPrice(product, line.withContainer),
          logged_by: profile.id,
          logged_by_role: profile.role,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
    if (payload.length === 0) return toast('Add products to the cart first');

    setBusy(true);
    const { data, error } = await supabase.from('collections').insert(payload).select('*');
    if (error) {
      setBusy(false);
      toast('Could not log order');
      return;
    }
    if (data) {
      setOrderRows((prev) => {
        const incoming = data as Collection[];
        const ids = new Set(incoming.map((r) => r.id));
        return [...incoming, ...prev.filter((r) => !ids.has(r.id))];
      });
    }

    const reorder = await persistStore({ id: store.id, lguId: store.lgu_id, willReorder: true, patch: {} });
    if (reorder.store) setStores((prev) => prev.map((s) => (s.id === store.id ? reorder.store! : s)));
    else setStores((prev) => prev.map((s) => (s.id === store.id ? { ...s, will_reorder: true } : s)));
    setWillReorder('yes');

    setBusy(false);
    setCart([]);
    setCheckout(null);
    toast(
      orderPayWhen === 'now'
        ? `Order logged · paid now · ${peso(checkoutTotal)}`
        : `Order logged · pay ${shortPaid(orderDueOn)} · ${peso(checkoutTotal)}`
    );
  };

  const startEditOrder = (order: Collection) => {
    setEditQty(Math.max(1, Number(order.quantity) || 1));
    setEditContainer(order.with_container);
    setOrderEdit(order);
  };

  const saveOrderEdit = async () => {
    if (!orderEdit) return;
    const product = productById(products, orderEdit.product_id);
    const qty = Math.max(1, Math.round(editQty || 1));
    const price = product ? productPrice(product, editContainer) : orderEdit.unit_price;
    setBusy(true);
    const { data, error } = await supabase
      .from('collections')
      .update({ quantity: qty, with_container: editContainer, unit_price: price })
      .eq('id', orderEdit.id)
      .select('*')
      .single();
    setBusy(false);
    if (error) {
      toast('Could not update reorder');
      return;
    }
    if (data) setOrderRows((prev) => prev.map((r) => (r.id === data.id ? (data as Collection) : r)));
    setOrderEdit(null);
    toast('Reorder updated');
  };

  const deleteOrder = async () => {
    if (!orderDelete) return;
    const id = orderDelete.id;
    setBusy(true);
    const { error } = await supabase.from('collections').delete().eq('id', id);
    setBusy(false);
    if (error) {
      toast('Could not delete reorder');
      return;
    }
    setOrderRows((prev) => prev.filter((r) => r.id !== id));
    setOrderDelete(null);
    toast('Reorder deleted');
  };

  const markDelivered = async (order: Collection) => {
    if (parseOrderPay(order.notes).deliveredOn !== null) return toast('Already tagged delivered');
    setBusy(true);
    const notes = withDelivered(order.notes, manilaYmd());
    const { data, error } = await supabase
      .from('collections')
      .update({ notes })
      .eq('id', order.id)
      .select('*')
      .single();
    setBusy(false);
    if (error) {
      toast('Could not tag delivered');
      return;
    }
    if (data) setOrderRows((prev) => prev.map((r) => (r.id === data.id ? (data as Collection) : r)));
    toast('Tagged delivered');
  };

  const postFeedback = async () => {
    if (!store) return toast('Save the store first');
    const note = feedbackNote.trim();
    if (!note) return toast('Write the feedback first');
    setBusy(true);
    const result = await persistStoreFeedback({ storeId: store.id, topic: feedbackTopic, note });
    setBusy(false);
    if (result.error || !result.feedback) {
      toast(
        /store_feedback|schema cache|does not exist/i.test(result.error || '')
          ? 'Feedback table is not set up yet'
          : result.error || 'Could not post feedback'
      );
      return;
    }
    setFeedbackRows((prev) => [result.feedback!, ...prev.filter((r) => r.id !== result.feedback!.id)]);
    if (result.store) setStores((prev) => prev.map((s) => (s.id === store.id ? result.store! : s)));
    setFeedbackNote('');
    toast('Feedback posted');
  };

  const deleteFeedback = async () => {
    if (!feedbackDelete) return;
    const id = feedbackDelete.id;
    setBusy(true);
    const result = await removeStoreFeedback(id);
    setBusy(false);
    if (result.error) {
      toast(result.error || 'Could not delete feedback');
      return;
    }
    setFeedbackRows((prev) => prev.filter((r) => r.id !== id));
    setFeedbackDelete(null);
    toast('Feedback deleted');
  };

  useEffect(() => {
    const due = storesDueForFullyPaid(stores, payRows);
    if (!due.length) return;
    let cancelled = false;
    void (async () => {
      const saved = new Map<string, Store>();
      for (const s of due) {
        const result = await persistStore({ id: s.id, lguId: s.lgu_id, patch: { pay_plan: 'fully_paid' } });
        if (result.store) saved.set(result.store.id, result.store);
      }
      if (cancelled || !saved.size) return;
      setStores((prev) => prev.map((s) => saved.get(s.id) ?? s));
    })();
    return () => {
      cancelled = true;
    };
  }, [payRows, stores, supabase]);

  const today = manilaYmd();
  const paidOnStore = store ? planPaidCount(payRows, store.id, store.claimed_on) : 0;
  const kitDone = Boolean(store && !isInstallmentStore(store, payRows));
  const installmentStores = stores.filter((s) => isInstallmentStore(s, payRows));
  const paidThisWeek = installmentStores.filter((s) => {
    const week = installmentWeekFor(today, s.claimed_on);
    return Boolean(week && paymentForWeek(payRows, s.id, week.start, s.claimed_on));
  }).length;
  const dueThisWeek = installmentStores.filter((s) => {
    const week = installmentWeekFor(today, s.claimed_on);
    return Boolean(week && !paymentForWeek(payRows, s.id, week.start, s.claimed_on));
  }).length;
  const collectedTotal = payRows.reduce((sum, p) => sum + Number(p.amount), 0);
  const pageTitle =
    tab === 'reorders'
      ? 'Reorders'
      : tab === 'feedback'
        ? 'Feedback'
        : tab === 'report'
          ? 'Report'
          : screen === 'list'
            ? 'Stores'
            : store
              ? storeDisplayName(store)
              : screen === 'new'
                ? 'New store'
                : 'Store';

  return (
    <div className={`app app--crm${navOpen ? ' is-nav' : ''}`}>
      {navOpen && (
        <button className="sidebar__scrim no-print" type="button" aria-label="Close menu" onClick={() => setNavOpen(false)} />
      )}
      <Sidebar
        open={navOpen}
        tab={tab}
        reorderCount={reorderCount}
        showReport={canSeeReport}
        onGo={go}
        onToggle={() => setNavOpen((open) => !open)}
      />
      <div className="app__body">
      <Topbar
        role={profile.role}
        name={profile.full_name || 'CENRO staff'}
        meta={scope}
        officerId={profile.officer_id}
        heading={pageTitle}
        status={status}
        onMenu={() => setNavOpen((open) => !open)}
        menuOpen={navOpen}
      />
      <main className="main">
        {tab === 'stores' && screen === 'list' && (
          <>
            <header className="pagehead pagehead--split">
              <div>
                <p className="kicker">{profile.officer_id || 'CENRO'} · {scope}</p>
                <h1>Stores</h1>
                <p className="sub">Your partner stores. Tap a store to collect a payment or take an order.</p>
              </div>
            </header>
            <div className="crm-stats">
              <div className="crm-stat">
                <strong>{stores.length}</strong>
                <span>Accounts</span>
              </div>
              <div className="crm-stat">
                <strong>{paidThisWeek}</strong>
                <span>Paid this week</span>
              </div>
              <div className="crm-stat">
                <strong>{dueThisWeek}</strong>
                <span>Due this week</span>
              </div>
              <div className="crm-stat">
                <strong>{peso(collectedTotal)}</strong>
                <span>Collected</span>
              </div>
            </div>
            <div className="crm-toolbar">
              <div className="filterbar filterbar--stores">
                <FilterMenu
                  id="list-city"
                  openId={placeMenu}
                  setOpenId={setPlaceMenu}
                  label="City"
                  value={listCity}
                  options={listCityOptions}
                  searchable
                  onChange={(next) => {
                    setListCity(next);
                    if (listBarangay !== 'all') {
                      const still = stores.some(
                        (s) =>
                          (next === 'all' || storeCityName(s) === next) &&
                          (s.barangay || '').trim() === listBarangay
                      );
                      if (!still) setListBarangay('all');
                    }
                  }}
                />
                <FilterMenu
                  id="list-barangay"
                  openId={placeMenu}
                  setOpenId={setPlaceMenu}
                  label="Barangay"
                  value={listBarangay}
                  options={listBarangayOptions}
                  searchable
                  onChange={setListBarangay}
                />
              </div>
              <label className="search">
                <svg className="search__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3-3" />
                </svg>
                <span className="sr">Search</span>
                <input
                  className="input"
                  placeholder="Search name, ID, or number"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
              <button className="btn btn-primary" type="button" onClick={openNew}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New ARRP
              </button>
            </div>
            <div className="storelist">
              {filtered.length ? (
                filtered.map((s) => {
                  const installment = isInstallmentStore(s, payRows);
                  const paidCount = planPaidCount(payRows, s.id, s.claimed_on);
                  const pendingCount = installment ? planPendingCount(payRows, s.id, s.claimed_on) : 0;
                  const storeWeek = installment ? installmentWeekFor(today, s.claimed_on) : null;
                  const paidNow = Boolean(storeWeek && paymentForWeek(payRows, s.id, storeWeek.start, s.claimed_on));
                  const dueOrders = orderRows.filter(
                    (r) => r.store_id === s.id && r.is_reorder && Boolean(parseOrderPay(r.notes).dueOn)
                  ).length;
                  const pendingPayments = (installment ? pendingCount : 0) + dueOrders;
                  const title = storeDisplayName(s);
                  return (
                    <button type="button" className="storecard" key={s.id} onClick={() => openStore(s)}>
                      <span className="storecard__av" aria-hidden="true">{initials(title)}</span>
                      <div className="storecard__body">
                        <div className="storecard__top">
                          <div className="t">{title}</div>
                          <div className="storecard__tags">
                            {!installment ? (
                              <span className="chip chip--ok">Paid in full</span>
                            ) : paidNow ? (
                              <span className="chip chip--ok">Paid</span>
                            ) : storeWeek ? (
                              <span className="chip chip--due">Due</span>
                            ) : null}
                            {pendingPayments > 0 && (
                              <span className="chip chip--pending">{pendingPayments} pending</span>
                            )}
                          </div>
                        </div>
                        <div className="storecard__line">
                          {s.arrp_id ? `${s.arrp_id} · ` : ''}
                          {storePlace(s)}
                        </div>
                        {installment ? (
                          <div className="storecard__progress">
                            <div className="storecard__bar" aria-hidden="true">
                              <span style={{ width: `${(paidCount / INSTALLMENT_WEEKS) * 100}%` }} />
                            </div>
                            <span>{paidCount}/{INSTALLMENT_WEEKS} paid</span>
                          </div>
                        ) : (
                          <div className="storecard__line">Waiting for refill</div>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <Empty
                  msg={
                    stores.length
                      ? 'No stores match these filters.'
                      : 'No stores yet. Create one to start collections.'
                  }
                />
              )}
            </div>
          </>
        )}

        {tab === 'stores' && (screen === 'new' || screen === 'store') && (
          <form onSubmit={saveStore} className={`crm-form${screen === 'store' ? ' crm-form--visit' : ''}`}>
            <header className="pagehead pagehead--split">
              <div>
                <button type="button" className="back" onClick={() => setScreen('list')}>
                  Stores
                </button>
                {screen === 'new' && <p className="kicker">New account</p>}
                <h1>{screen === 'new' ? 'Open ARRP' : store ? storeDisplayName(store) : 'Store'}</h1>
                <p className="sub">
                  {screen === 'new'
                    ? 'IDs are assigned when you open the partner. Collection starts after the claim week if they are on installment.'
                    : [store?.arrp_id, form.city, form.barangay].filter(Boolean).join(' · ')}
                </p>
              </div>
              {screen === 'new' && (
                <button className="btn btn-primary pagehead__save" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Open ARRP'}
                </button>
              )}
            </header>

            <div className="crm-grid">
            <section className="sheet">
              <header className="sheet__h sheet__h--row">
                <h3>Details</h3>
                {screen === 'store' && !editDetails && (
                  <button type="button" className="btn-ghost btn-edit" aria-label="Edit store details" onClick={() => setEditDetails(true)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    Edit
                  </button>
                )}
              </header>

              {screen === 'store' && !editDetails && store ? (
                <StoreProfileView store={store} />
              ) : (
                <>
                  <StoreProfileForm
                    form={form}
                    placeMenu={placeMenu}
                    setPlaceMenu={setPlaceMenu}
                    onChange={patchForm}
                    showMoreDefault={screen === 'store'}
                  />
                  {screen === 'store' && editDetails && (
                    <div className="detail__actions">
                      <button type="button" className="btn-ghost" onClick={cancelEdit} disabled={busy}>
                        Cancel
                      </button>
                      <button className="btn btn-primary" type="submit" disabled={busy}>
                        {busy ? 'Saving…' : 'Save details'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {screen === 'store' && store && (isInstallmentStore(store, payRows) || paidOnStore > 0 || store.pay_plan === 'fully_paid') && (
              <section className="sheet sheet--wide">
                <header className="sheet__h sheet__h--row">
                  <div>
                    <h3>Collection</h3>
                    <p className="sub">
                      {kitDone
                        ? 'Kit paid in full. Only refill orders from here.'
                        : `First kit · ₱550 × ${INSTALLMENT_WEEKS}${planWeeks[0] ? ` · starts ${shortPaid(planWeeks[0].start)}` : ''}`}
                    </p>
                  </div>
                  <p className="sheet__count">{kitDone ? `${INSTALLMENT_WEEKS}/${INSTALLMENT_WEEKS}` : `${paidOnStore}/${INSTALLMENT_WEEKS}`}</p>
                </header>
                {kitDone && paidOnStore === 0 ? (
                  <p className="paid-note">
                    Fully paid
                    {store.claimed_on ? ` · claimed ${shortPaid(store.claimed_on)}` : ''}. No weekly kit collection — waiting for refill.
                  </p>
                ) : (
                  <div className="weeklist">
                    {planWeeks.map((week) => {
                      const payment = paymentForWeek(storePays, store.id, week.start, store.claimed_on);
                      const isCurrent = currentWeek?.start === week.start;
                      const isNext = !kitDone && week.week === paidOnStore + 1;
                      const weekOrders = storeOrders.filter((r) => r.is_reorder && orderInWeek(r, week));
                      const weekOrderTotal = weekOrders.reduce(
                        (sum, r) => sum + Number(r.unit_price ?? 0) * Math.max(1, Number(r.quantity) || 1),
                        0
                      );
                      const weekDue = weekOrders.filter((r) => parseOrderPay(r.notes).dueOn);
                      const isOverdue = isNext && week.end < today;
                      const paidLate = payment ? isLatePayment(payment, week) : false;
                      return (
                        <div
                          className={`weekrow${isCurrent || isNext ? ' is-now' : ''}${payment ? ' is-paid' : ''}${isOverdue ? ' is-overdue' : ''}`}
                          key={week.start}
                        >
                          <div className="weekrow__n">{week.week}</div>
                          <div className="weekrow__body">
                            <div className="weekrow__h">
                              <div className="t">
                                {weekRangeLabel(week)}
                                {paidLate && <span className="chip chip--late">Late</span>}
                                {isOverdue && <span className="chip chip--overdue">Overdue</span>}
                              </div>
                              {payment ? (
                                <span className="weekrow__paid-amt">{peso(Number(payment.amount))}</span>
                              ) : null}
                            </div>
                            {payment ? (
                              <p className="weekrow__paid-meta">
                                {[payMethodOf(payment.notes), payment.logged_by_name, shortPaid(payment.paid_on)]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            ) : isNext ? (
                              <button
                                className="btn btn-primary btn-tight"
                                type="button"
                                disabled={busy}
                                onClick={() => requestTag(week)}
                              >
                                Mark paid · week {week.week} of {INSTALLMENT_WEEKS}
                              </button>
                            ) : null}
                            {weekOrders.length > 0 && (
                              <p className="weekrow__orders">
                                Refill {peso(weekOrderTotal)}
                                {weekDue.length > 0
                                  ? ` · due ${shortPaid(parseOrderPay(weekDue[0].notes).dueOn || week.start)}`
                                  : ' · paid with order'}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            <section className="sheet sheet--wide">
              <header className="sheet__h">
                <h3>Taking an order?</h3>
              </header>
              <div className="seg seg--wide">
                <button
                  type="button"
                  className={willReorder === 'yes' ? 'is-on' : ''}
                  onClick={() => setWillReorder('yes')}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={willReorder === 'no' ? 'is-on' : ''}
                  onClick={() => {
                    setWillReorder('no');
                    setCart([]);
                  }}
                >
                  No
                </button>
              </div>

              {willReorder === 'yes' && (
                <div className="reorder-list">
                  <div className="reorder-shop">
                    <div className="reorder-shop__list">
                      <ProductCatalog
                        products={products}
                        selectedId=""
                        withContainer={false}
                        isReorder
                        showReorderTag={false}
                        qtyFor={(id, container) =>
                          cart.find((l) => l.productId === id && l.withContainer === container)?.qty ?? 0
                        }
                        onPickPrice={addToCart}
                      />
                    </div>
                    <div className="reorder-shop__cart">
                      {cart.length > 0 ? (
                        <div className="cart">
                          {cart.map((line) => {
                            const product = productById(products, line.productId);
                            const unit = product ? productPrice(product, line.withContainer) : 0;
                            return (
                              <div className="cart__line" key={`${line.productId}:${line.withContainer ? 'c' : 'r'}`}>
                                <div className="cart__meta">
                                  <div className="t">{product?.name ?? 'Product'}</div>
                                  <div className="s">
                                    {line.withContainer ? 'with container' : 'refill'} · {peso(unit)}
                                  </div>
                                </div>
                                <div className="stepper stepper--sm">
                                  <button
                                    type="button"
                                    className="stepper__b"
                                    aria-label="Decrease quantity"
                                    onClick={() => setCartQty(line.productId, line.withContainer, line.qty - 1)}
                                  >
                                    −
                                  </button>
                                  <input
                                    className="stepper__in"
                                    type="number"
                                    min={1}
                                    inputMode="numeric"
                                    aria-label="Quantity"
                                    value={line.qty}
                                    onChange={(e) =>
                                      setCartQty(line.productId, line.withContainer, Number(e.target.value) || 1)
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="stepper__b"
                                    aria-label="Increase quantity"
                                    onClick={() => setCartQty(line.productId, line.withContainer, line.qty + 1)}
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="cart__sum">{peso(unit * line.qty)}</div>
                              </div>
                            );
                          })}
                          <div className="cart__total">
                            <span>Order total</span>
                            <strong>{peso(cartTotal)}</strong>
                          </div>
                        </div>
                      ) : (
                        <p className="pricehint">Tap a price to add it. Cart stays here.</p>
                      )}
                      {screen === 'store' && store ? (
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={busy || cart.length === 0}
                          onClick={requestLogOrder}
                        >
                          Log order
                        </button>
                      ) : (
                        <p className="pricehint">Save the store first to log this order.</p>
                      )}
                    </div>
                  </div>
                  {storeOrders.length > 0 && (
                    <div className="recent recent--scroll">
                      {storeOrders.slice(0, 8).map((r) => {
                        const p = productById(products, r.product_id);
                        const qty = Math.max(1, Number(r.quantity) || 1);
                        return (
                          <div className="item" key={r.id}>
                            <div className="meta">
                              <div className="t">
                                {p?.name ?? 'Refill'}
                                {qty > 1 && <span className="qtybadge">×{qty}</span>}
                              </div>
                              <div className="s">
                                {(() => {
                                  const pay = parseOrderPay(r.notes);
                                  if (pay.deliveredOn !== null) {
                                    return `Delivered${pay.deliveredOn ? ` ${shortPaid(pay.deliveredOn)}` : ''}`;
                                  }
                                  if (pay.dueOn) return `Due ${shortPaid(pay.dueOn)}`;
                                  if (pay.method) return `Paid ${pay.method}`;
                                  return r.is_reorder ? 'Reorder' : 'Refill';
                                })()}
                                {' · '}
                                {tstamp(r.created_at)}
                                {r.logged_by_name ? ` · by ${r.logged_by_name}` : ''}
                              </div>
                            </div>
                            <div className="item__right">
                              <div className="num">
                                {r.unit_price != null ? peso(Number(r.unit_price) * qty) : ''}
                              </div>
                              <div className="item__acts">
                                {r.is_reorder && parseOrderPay(r.notes).deliveredOn === null && (
                                  <button
                                    className="iconbtn"
                                    type="button"
                                    disabled={busy}
                                    onClick={() => markDelivered(r)}
                                  >
                                    Delivered
                                  </button>
                                )}
                                <button
                                  className="iconbtn"
                                  type="button"
                                  disabled={busy}
                                  onClick={() => startEditOrder(r)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="iconbtn iconbtn--danger"
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setOrderDelete(r)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="sheet sheet--wide">
              <header className="sheet__h">
                <h3>Feedback</h3>
              </header>
              {screen === 'store' && store ? (
                <>
                  <div className="seg seg--wide seg--3">
                    <button
                      type="button"
                      className={feedbackTopic === 'product' ? 'is-on' : ''}
                      onClick={() => setFeedbackTopic('product')}
                    >
                      Product
                    </button>
                    <button
                      type="button"
                      className={feedbackTopic === 'service' ? 'is-on' : ''}
                      onClick={() => setFeedbackTopic('service')}
                    >
                      Service
                    </button>
                    <button
                      type="button"
                      className={feedbackTopic === 'general' ? 'is-on' : ''}
                      onClick={() => setFeedbackTopic('general')}
                    >
                      General
                    </button>
                  </div>
                  <label className="field">
                    <span>Add feedback</span>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="What did they say on this visit?"
                      value={feedbackNote}
                      onChange={(e) => setFeedbackNote(e.target.value)}
                    />
                  </label>
                  <button className="btn btn-primary btn-add" type="button" disabled={busy} onClick={postFeedback}>
                    {busy ? 'Posting…' : 'Add feedback'}
                  </button>
                  {feedbackRows.length > 0 ? (
                    <div className="feed">
                      {feedbackRows.map((row) => (
                        <article className="feedpost" key={row.id}>
                          <div className="feedpost__top">
                            <span className={`paytag paytag--${row.topic === 'service' ? 'gcash' : 'cash'}`}>
                              {topicLabel(row.topic)}
                            </span>
                            <button
                              className="iconbtn iconbtn--danger"
                              type="button"
                              disabled={busy}
                              onClick={() => setFeedbackDelete(row)}
                            >
                              Delete
                            </button>
                          </div>
                          <p className="feedpost__note">{row.note}</p>
                          <p className="feedpost__meta">
                            {row.logged_by_name ? `by ${row.logged_by_name} · ` : ''}
                            {tstamp(row.created_at)}
                          </p>
                          {repliesFor(feedbackReplies, 'store', row.id).map((r) => (
                            <div className="feedpost feedpost--reply" key={r.id}>
                              <p className="feedpost__note">{r.note}</p>
                              <p className="feedpost__meta">
                                {r.logged_by_name || 'Ops'} · {tstamp(r.created_at)}
                              </p>
                            </div>
                          ))}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="pricehint">No feedback posted yet.</p>
                  )}
                </>
              ) : (
                <>
                  <p className="pricehint">Save the store first to add timestamped feedback.</p>
                  <div className="form__actions">
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                      {busy ? 'Saving…' : 'Open ARRP'}
                    </button>
                  </div>
                </>
              )}
            </section>
            </div>
          </form>
        )}

        {tab === 'reorders' && (
          <ReordersPanel
            stores={stores}
            products={products}
            orders={orderRows}
            payments={payRows}
            busy={busy}
            onOpenStore={openStore}
            onMarkDelivered={markDelivered}
          />
        )}

        {tab === 'feedback' && <FeedbackPanel profile={profile} replies={feedbackReplies} />}

        {tab === 'report' && canSeeReport && (
          <ReportPanel
            stores={stores}
            products={products}
            orders={orderRows}
            payments={payRows}
            officer={profile.full_name || 'CENRO staff'}
            officerId={profile.officer_id}
            scope={scope}
          />
        )}
      </main>
      </div>

      {confirmPay && store && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm collection">
          <button
            className="modal__scrim"
            type="button"
            aria-label="Cancel"
            onClick={() => !busy && setConfirmPay(null)}
          />
          <div className="modal__card">
            <header className="modal__head">
              <p className="kicker">Confirm collection</p>
              <h3>Are you sure?</h3>
              <p className="sub">
                Week {confirmPay.week.week} · {weekRangeLabel(confirmPay.week)} for {storeDisplayName(store)}
              </p>
            </header>

            <dl className="modal__facts">
              <div>
                <dt>Amount</dt>
                <dd>{peso(WEEKLY_INSTALLMENT)}</dd>
              </div>
              <div>
                <dt>Collected by</dt>
                <dd>{profile.full_name || 'CENRO staff'}</dd>
              </div>
            </dl>

            <label className="field">
              <span>Date paid</span>
              <input
                className="input"
                type="date"
                value={payDate}
                max={today}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </label>
            {payDate > confirmPay.week.end ? (
              <p className="modal__warn">
                This is after the week ended ({shortPaid(confirmPay.week.end)}) — it will be tagged as a late payment.
              </p>
            ) : null}

            <p className="modal__label">Mode of payment</p>
            <div className="seg seg--wide">
              <button
                type="button"
                className={payMethod === 'Cash' ? 'is-on' : ''}
                onClick={() => setPayMethod('Cash')}
              >
                Cash
              </button>
              <button
                type="button"
                className={payMethod === 'GCash' ? 'is-on' : ''}
                onClick={() => setPayMethod('GCash')}
              >
                GCash
              </button>
            </div>

            <div className="modal__actions">
              <button
                className="btn-ghost"
                type="button"
                disabled={busy}
                onClick={() => setConfirmPay(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy}
                onClick={commitPayment}
              >
                {busy ? 'Saving…' : `Confirm ${payMethod}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {checkout && store && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Log order">
          <button
            className="modal__scrim"
            type="button"
            aria-label="Cancel"
            onClick={() => !busy && setCheckout(null)}
          />
          <div className="modal__card">
            <header className="modal__head">
              <p className="kicker">Log order</p>
              <h3>Are you sure?</h3>
              <p className="sub">
                {checkout.length} {checkout.length === 1 ? 'item' : 'items'} for {storeDisplayName(store)}
              </p>
            </header>

            <div className="cart cart--modal">
              {checkout.map((line) => {
                const product = productById(products, line.productId);
                const unit = product ? productPrice(product, line.withContainer) : 0;
                return (
                  <div className="cart__line" key={`${line.productId}:${line.withContainer ? 'c' : 'r'}`}>
                    <div className="cart__meta">
                      <div className="t">
                        {product?.name ?? 'Product'} ×{line.qty}
                      </div>
                      <div className="s">{line.withContainer ? 'with container' : 'refill'}</div>
                    </div>
                    <div className="cart__sum">{peso(unit * line.qty)}</div>
                  </div>
                );
              })}
            </div>

            <dl className="modal__facts">
              <div>
                <dt>Order total</dt>
                <dd>{peso(checkoutTotal)}</dd>
              </div>
            </dl>

            <p className="modal__label">Payment</p>
            <div className="seg seg--wide">
              <button
                type="button"
                className={orderPayWhen === 'now' ? 'is-on' : ''}
                onClick={() => setOrderPayWhen('now')}
              >
                Pay now
              </button>
              <button
                type="button"
                className={orderPayWhen === 'later' ? 'is-on' : ''}
                onClick={() => setOrderPayWhen('later')}
              >
                When to pay
              </button>
            </div>

            {orderPayWhen === 'now' ? (
              <>
                <p className="modal__label">Mode of payment</p>
                <div className="seg seg--wide">
                  <button type="button" className={payMethod === 'Cash' ? 'is-on' : ''} onClick={() => setPayMethod('Cash')}>
                    Cash
                  </button>
                  <button type="button" className={payMethod === 'GCash' ? 'is-on' : ''} onClick={() => setPayMethod('GCash')}>
                    GCash
                  </button>
                </div>
              </>
            ) : (
              <label className="field">
                <span>Pay on</span>
                <input className="input" type="date" value={orderDueOn} onChange={(e) => setOrderDueOn(e.target.value)} />
              </label>
            )}

            <div className="modal__actions">
              <button className="btn-ghost" type="button" disabled={busy} onClick={() => setCheckout(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" disabled={busy} onClick={commitLogOrder}>
                {busy
                  ? 'Saving…'
                  : orderPayWhen === 'now'
                    ? `Confirm ${payMethod}`
                    : `Confirm due ${shortPaid(orderDueOn)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {orderEdit && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Edit reorder">
          <button
            className="modal__scrim"
            type="button"
            aria-label="Cancel"
            onClick={() => !busy && setOrderEdit(null)}
          />
          <div className="modal__card">
            <header className="modal__head">
              <p className="kicker">Edit reorder</p>
              <h3>{productById(products, orderEdit.product_id)?.name ?? 'Refill'}</h3>
              <p className="sub">Logged {tstamp(orderEdit.created_at)}{orderEdit.logged_by_name ? ` · by ${orderEdit.logged_by_name}` : ''}</p>
            </header>

            <p className="modal__label">Type</p>
            <div className="seg seg--wide">
              <button
                type="button"
                className={!editContainer ? 'is-on' : ''}
                onClick={() => setEditContainer(false)}
              >
                Refill
              </button>
              <button
                type="button"
                className={editContainer ? 'is-on' : ''}
                onClick={() => setEditContainer(true)}
              >
                With container
              </button>
            </div>

            <p className="modal__label">Quantity</p>
            <div className="stepper stepper--wide">
              <button
                type="button"
                className="stepper__b"
                aria-label="Decrease quantity"
                onClick={() => setEditQty((n) => Math.max(1, n - 1))}
              >
                −
              </button>
              <input
                className="stepper__in"
                type="number"
                min={1}
                inputMode="numeric"
                aria-label="Quantity"
                value={editQty}
                onChange={(e) => setEditQty(Math.max(1, Math.round(Number(e.target.value) || 1)))}
              />
              <button
                type="button"
                className="stepper__b"
                aria-label="Increase quantity"
                onClick={() => setEditQty((n) => n + 1)}
              >
                +
              </button>
            </div>

            {(() => {
              const p = productById(products, orderEdit.product_id);
              const unit = p ? productPrice(p, editContainer) : Number(orderEdit.unit_price ?? 0);
              return (
                <p className="pricehint">
                  {editQty} × {peso(unit)} = <strong>{peso(unit * editQty)}</strong>
                </p>
              );
            })()}

            <div className="modal__actions">
              <button className="btn-ghost" type="button" disabled={busy} onClick={() => setOrderEdit(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" disabled={busy} onClick={saveOrderEdit}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {orderDelete && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Delete reorder">
          <button
            className="modal__scrim"
            type="button"
            aria-label="Cancel"
            onClick={() => !busy && setOrderDelete(null)}
          />
          <div className="modal__card">
            <header className="modal__head">
              <p className="kicker kicker--danger">Delete reorder</p>
              <h3>Are you sure?</h3>
              <p className="sub">
                This permanently removes the {productById(products, orderDelete.product_id)?.name ?? 'reorder'}
                {Number(orderDelete.quantity) > 1 ? ` ×${orderDelete.quantity}` : ''} logged {tstamp(orderDelete.created_at)}. This cannot be undone.
              </p>
            </header>
            <div className="modal__actions">
              <button className="btn-ghost" type="button" disabled={busy} onClick={() => setOrderDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" type="button" disabled={busy} onClick={deleteOrder}>
                {busy ? 'Deleting…' : 'Delete reorder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {feedbackDelete && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Delete feedback">
          <button
            className="modal__scrim"
            type="button"
            aria-label="Cancel"
            onClick={() => !busy && setFeedbackDelete(null)}
          />
          <div className="modal__card">
            <header className="modal__head">
              <p className="kicker kicker--danger">Delete feedback</p>
              <h3>Are you sure?</h3>
              <p className="sub">
                This removes the {topicLabel(feedbackDelete.topic).toLowerCase()} note posted {tstamp(feedbackDelete.created_at)}
                {feedbackDelete.logged_by_name ? ` by ${feedbackDelete.logged_by_name}` : ''}. This cannot be undone.
              </p>
            </header>
            <div className="modal__actions">
              <button className="btn-ghost" type="button" disabled={busy} onClick={() => setFeedbackDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" type="button" disabled={busy} onClick={deleteFeedback}>
                {busy ? 'Deleting…' : 'Delete feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type CartLine = { productId: string; withContainer: boolean; qty: number };

function buildPayNotes(method: PayMethod, paidOn: string, late: boolean): string {
  return `[${method}]${late ? ' Late ·' : ''} Paid ${paidOn} · ${manilaTimeLabel()}`;
}

function payMethodOf(notes: string | null | undefined): PayMethod | null {
  const m = /^\[(Cash|GCash)\]/.exec(notes ?? '');
  return m ? (m[1] as PayMethod) : null;
}

/** A week is paid late when the payment date falls after the week's end. */
function isLatePayment(
  payment: { paid_on?: string | null; notes?: string | null },
  week: InstallmentWeek
): boolean {
  if (/\bLate\b/i.test(payment.notes ?? '')) return true;
  const paidOn = (payment.paid_on ?? '').slice(0, 10);
  return Boolean(paidOn) && paidOn > week.end;
}

function orderInWeek(order: Collection, week: InstallmentWeek): boolean {
  const pay = parseOrderPay(order.notes);
  const day = pay.paidOn || pay.dueOn;
  if (!day) return false;
  return week.start <= day && day <= week.end;
}

function topicLabel(topic: FeedbackTopic): string {
  if (topic === 'product') return 'Product';
  if (topic === 'service') return 'Service';
  return 'General';
}

function storePlace(store: Store): string {
  const parts = [store.barangay, store.city, store.address].filter((v) => v && v !== '—');
  return [...new Set(parts)].join(' · ') || 'No address';
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? parts[0]?.[1] ?? ''}`.toUpperCase();
  return letters || 'S';
}

function shortPaid(ymdValue: string): string {
  const [y, m, d] = ymdValue.split('-').map(Number);
  if (!y || !m || !d) return ymdValue;
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

