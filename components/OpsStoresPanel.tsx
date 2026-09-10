'use client';

import { useEffect, useMemo, useState } from 'react';
import { persistStore, removeStore } from '@/app/ops/actions';
import { isInstallmentStore } from '@/lib/installments';
import {
  blankStoreForm,
  classificationLabel,
  formFromStore,
  payPlanLabel,
  storeDisplayName,
  storeSearchText,
  toStorePatch,
  type StoreForm,
} from '@/lib/storeProfile';
import type { Collection, Lgu, Payment, Profile, Store } from '@/lib/types';
import { tstamp } from '@/lib/format';
import { StoreProfileForm } from './StoreProfile';
import { ConfirmModal } from './ConfirmModal';
import { FormModal } from './FormModal';
import { Empty, toast } from './ui';

export function OpsStoresPanel({
  profile,
  stores,
  lgus,
  busy,
  setBusy,
  onChange,
  focusId,
  orders = [],
  payments = [],
}: {
  profile: Profile;
  stores: Store[];
  lgus: Lgu[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onChange: (next: Store[]) => void;
  focusId?: string | null;
  orders?: Collection[];
  payments?: Payment[];
}) {
  const defaultLgu = profile.lgu_id || lgus.find((l) => l.name === 'Taguig')?.id || lgus[0]?.id || '';
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | 'new' | null>(focusId || null);
  const [lguId, setLguId] = useState(defaultLgu);
  const [active, setActive] = useState(true);
  const [form, setForm] = useState<StoreForm>(blankStoreForm());
  const [placeMenu, setPlaceMenu] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<'delete' | 'blocked' | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const rows = query ? stores.filter((s) => storeSearchText(s).includes(query)) : stores;
    return rows.slice().sort((a, b) => storeDisplayName(a).localeCompare(storeDisplayName(b)));
  }, [stores, q]);

  const selected = openId && openId !== 'new' ? stores.find((s) => s.id === openId) ?? null : null;

  useEffect(() => {
    if (!focusId) return;
    const s = stores.find((x) => x.id === focusId);
    if (!s) return;
    setOpenId(s.id);
    setForm(formFromStore(s));
    setLguId(s.lgu_id);
    setActive(s.active !== false);
  }, [focusId]);

  const openNew = () => {
    setOpenId('new');
    setForm(blankStoreForm());
    setLguId(defaultLgu);
    setActive(true);
    setPlaceMenu(null);
  };

  const openStore = (s: Store) => {
    setOpenId(s.id);
    setForm(formFromStore(s));
    setLguId(s.lgu_id);
    setActive(s.active !== false);
    setPlaceMenu(null);
  };

  const storeLinks = selected
    ? {
        collections: orders.filter((o) => o.store_id === selected.id).length,
        payments: payments.filter((p) => p.store_id === selected.id).length,
      }
    : { collections: 0, payments: 0 };

  const askSave = () => {
    const patch = toStorePatch(form, profile);
    if (!patch.first_name || !patch.last_name) return toast('Enter first and last name');
    if (!patch.phone) return toast('Enter a contact number');
    if (!lguId) return toast('Choose an LGU');
    void save();
  };

  const askDelete = () => {
    if (!selected) return;
    if (storeLinks.collections || storeLinks.payments) setPrompt('blocked');
    else setPrompt('delete');
  };

  const save = async () => {
    if (openId !== 'new' && !selected) return;
    const patch = toStorePatch(form, profile);
    setBusy(true);
    const result = await persistStore({
      id: openId === 'new' ? null : selected?.id,
      lguId,
      active,
      patch,
    });
    setBusy(false);
    setPrompt(null);
    if (result.error || !result.store) return toast(result.error || (openId === 'new' ? 'Could not add store' : 'Could not save store'));
    const saved = result.store;
    onChange(openId === 'new' ? [...stores, saved] : stores.map((s) => (s.id === saved.id ? saved : s)));
    setOpenId(null);
    toast(openId === 'new' ? 'Store added' : 'Store updated');
  };

  const remove = async () => {
    if (!selected) return;
    setBusy(true);
    const result = await removeStore(selected.id);
    setBusy(false);
    setPrompt(null);
    if (result.error) return toast(result.error);
    onChange(stores.filter((s) => s.id !== selected.id));
    setOpenId(null);
    toast('Store deleted');
  };

  return (
    <>
      <header className="pagehead pagehead--split">
        <div>
          <p className="kicker">{profile.officer_id} · ARRP</p>
          <h1>Stores</h1>
          <p className="sub">Add partners and edit the full store profile. RK and ARRP IDs are assigned on create.</p>
        </div>
        <button type="button" className="btn btn-primary pagehead__save" onClick={openNew}>
          + Add store
        </button>
      </header>

      <section className="sheet">
        <header className="sheet__h sheet__h--row">
          <div>
            <h3>Directory</h3>
            <p className="sub">{stores.length} stores · {stores.filter((s) => isInstallmentStore(s, payments)).length} installment · click Edit to change</p>
          </div>
          <div className="ops-toolbar">
            <label className="search">
              <span className="sr">Search stores</span>
              <input className="input" value={q} placeholder="Search ID or name" onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
        </header>
        {filtered.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>IDs</th>
                  <th>Store</th>
                  <th>Type</th>
                  <th>Plan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className={openId === s.id ? 'is-on' : ''} onClick={() => openStore(s)}>
                    <td>
                      <div>{s.store_code || '—'}</div>
                      <div className="s">{s.arrp_id || ''}</div>
                    </td>
                    <td>
                      {storeDisplayName(s)}
                      <div className="s">{[s.city, s.barangay].filter((v) => v && v !== '—').join(' · ')}</div>
                    </td>
                    <td>{classificationLabel(s.classification)}</td>
                    <td>{payPlanLabel(isInstallmentStore(s, payments) ? 'installment' : 'fully_paid')}</td>
                    <td className="ops-edit">
                      <button type="button" className="btn-row" onClick={(e) => { e.stopPropagation(); openStore(s); }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty msg="No stores match that search." />
        )}
      </section>

      {openId && (
        <FormModal
          wide
          kicker={openId === 'new' ? 'Create' : 'Edit'}
          title={openId === 'new' ? 'Add store' : selected ? storeDisplayName(selected) : 'Store'}
          message={
            selected
              ? [selected.store_code, selected.arrp_id].filter(Boolean).join(' · ') || 'IDs assign on save'
              : 'RK and ARRP IDs assign when you save.'
          }
          confirmLabel={openId === 'new' ? 'Create store' : 'Save store'}
          dangerLabel={selected ? 'Delete' : undefined}
          busy={busy}
          locked={Boolean(prompt)}
          onClose={() => setOpenId(null)}
          onConfirm={askSave}
          onDanger={selected ? askDelete : undefined}
        >
          <label className="field">
            <span>LGU</span>
            <select className="input" value={lguId} onChange={(e) => setLguId(e.target.value)}>
              {lgus.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <StoreProfileForm
            form={form}
            placeMenu={placeMenu}
            setPlaceMenu={setPlaceMenu}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            showMoreDefault={openId === 'new'}
          />
          <label className="dev-check">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active store
          </label>
          {selected?.updated_at && (
            <p className="audit">
              Updated {tstamp(selected.updated_at)}
              {selected.updated_by_name ? ` · ${selected.updated_by_name}` : ''}
            </p>
          )}
        </FormModal>
      )}

      {prompt === 'delete' && selected && (
        <ConfirmModal
          kicker="Delete store"
          title="Are you sure?"
          message={`${storeDisplayName(selected)} has no kit collections or refill orders. This permanently removes the store.`}
          confirmLabel="Delete store"
          danger
          busy={busy}
          onClose={() => setPrompt(null)}
          onConfirm={remove}
        />
      )}
      {prompt === 'blocked' && selected && (
        <ConfirmModal
          kicker="Cannot delete"
          title="This store has connected data"
          message="Remove those rows in Database first. Deleting the store would break kit collections and refill orders."
          blocked
          onClose={() => setPrompt(null)}
        >
          <dl className="modal__facts">
            {storeLinks.payments > 0 && (
              <div>
                <dt>Kit collections</dt>
                <dd>{storeLinks.payments}</dd>
              </div>
            )}
            {storeLinks.collections > 0 && (
              <div>
                <dt>Refill orders</dt>
                <dd>{storeLinks.collections}</dd>
              </div>
            )}
          </dl>
        </ConfirmModal>
      )}
    </>
  );
}
