'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCollections } from '@/lib/hooks/useCollections';
import { MATERIALS, materialById, toSachetEquiv, type Profile, type Store } from '@/lib/types';
import { fmt, timeAgo, isToday } from '@/lib/format';
import { Topbar } from './Topbar';
import { Kpi, Empty, toast } from './ui';

export function LogClient({
  profile,
  scope,
  stores,
  initial,
}: {
  profile: Profile;
  scope: string;
  stores: Store[];
  initial: any[];
}) {
  const { rows, status } = useCollections(initial);
  const supabase = useMemo(() => createClient(), []);

  const [storeId, setStoreId] = useState<string>(stores[0]?.id ?? '');
  const [material, setMaterial] = useState(MATERIALS[0].id);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(MATERIALS[0].unit);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const mine = useMemo(
    () => rows.filter((r) => r.logged_by === profile.id),
    [rows, profile.id]
  );
  const todayCount = mine.filter((r) => isToday(r.created_at)).length;
  const refillMine = mine.filter((r) => r.material === 'refill').reduce((a, r) => a + Number(r.quantity), 0);
  const sachetMine = mine.reduce((a, r) => a + toSachetEquiv(r), 0);

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? '';

  const onMaterialChange = (id: string) => {
    setMaterial(id as any);
    setUnit(materialById(id).unit);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    const targetStore = storeId;
    if (!targetStore) return toast('No store selected');
    if (!(qty > 0)) return toast('Enter a quantity');

    setBusy(true);
    // logged_by defaults to auth.uid(); name/role are stamped server-side by trigger.
    const { error } = await supabase.from('collections').insert({
      store_id: targetStore,
      material,
      quantity: qty,
      unit,
      notes: notes.trim(),
      logged_by: profile.id,
      logged_by_role: profile.role,
    });
    setBusy(false);
    if (error) {
      toast('Save failed — check your access');
      return;
    }
    // Realtime will add the row; clear the form.
    setQuantity('');
    setNotes('');
    toast('Collection logged');
  };

  const unitOptions = Array.from(new Set([materialById(material).unit, 'pcs', 'kg', 'L']));

  return (
    <div className="app">
      <Topbar role={profile.role} name={profile.full_name || 'CENRO staff'} meta={scope} status={status} />
      <main className="main">
        <div className="viewhead">
          <div>
            <h1>Field Collection Log</h1>
            <p className="sub">
              Record collections gathered from stores in your area. Entries are timestamped and shared live.
            </p>
          </div>
        </div>

        <div className="kpis">
          <Kpi label="My entries today" value={todayCount} unit={`${mine.length} total logged`} accent="var(--green)" />
          <Kpi label="Refill dispensed (mine)" value={fmt(refillMine)} unit="litres" accent="var(--blue)" />
          <Kpi label="Sachet-equiv. diverted" value={fmt(sachetMine)} unit="from my entries" accent="var(--red)" />
        </div>

        <div className="grid side">
          <div className="card">
            <div className="card__h">
              <h3>New collection entry</h3>
              <span className="tag">auto-timestamped</span>
            </div>
            <div className="card__b">
              <form onSubmit={submit}>
                <div className="formgrid">
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
                    <label style={labelStyle}>Material</label>
                    <select className="input" value={material} onChange={(e) => onMaterialChange(e.target.value)}>
                      {MATERIALS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} ({m.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Quantity</label>
                    <div className="qtyrow">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        required
                      />
                      <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                        {unitOptions.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>
                      Notes <span style={{ color: 'var(--light)', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <textarea
                      className="input"
                      placeholder="e.g. weekly pickup, mixed brands"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
                <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 16 }}>
                  {busy ? 'Logging…' : '＋ Log collection'}
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card__h">
              <h3>My recent entries</h3>
              <span className="tag">{mine.length}</span>
            </div>
            <div className="card__b" style={{ paddingTop: 8 }}>
              {mine.length ? (
                <div className="recent">
                  {mine.slice(0, 9).map((r) => {
                    const m = materialById(r.material);
                    return (
                      <div className="item" key={r.id}>
                        <span className="swatch" style={{ background: m.color }} />
                        <div className="meta">
                          <div className="t">{m.label}</div>
                          <div className="s">
                            {storeName(r.store_id)} · {timeAgo(r.created_at)}
                          </div>
                        </div>
                        <div className="num" style={{ fontSize: '.9rem' }}>
                          {fmt(r.quantity)}{' '}
                          <span style={{ color: 'var(--light)', fontWeight: 400, fontSize: '.78rem' }}>{r.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty msg="No entries yet — log your first collection." />
              )}
            </div>
          </div>
        </div>

        <p className="footnote">
          Signed in as <strong>{profile.full_name || 'account'}</strong> · {scope} · RefillKa pre-pilot
        </p>
      </main>
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
