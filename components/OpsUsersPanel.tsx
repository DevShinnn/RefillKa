'use client';

import { useMemo, useState } from 'react';
import { createAccount, deleteAccount, getAccountUsage, resetPin, updateAccount } from '@/app/ops/actions';
import { loginToEmail, normalizeOfficerId } from '@/lib/loginId';
import { usageLines, usageTotal } from '@/lib/opsUsage';
import {
  ASSIGNABLE_ROLES,
  ROLE_LABEL,
  roleNeedsLgu,
  roleNeedsRegion,
  type Role,
} from '@/lib/roles';
import type { Lgu, Profile, Region } from '@/lib/types';
import { ConfirmModal } from './ConfirmModal';
import { FormModal } from './FormModal';
import { toast } from './ui';

type Draft = {
  officerId: string;
  fullName: string;
  role: Role;
  lguId: string;
  regionId: string;
  pin: string;
};

function blankDraft(role: Role, accounts: Profile[], defaultLgu: string, defaultRegion: string): Draft {
  return {
    officerId: suggestOfficerId(role, accounts),
    fullName: '',
    role,
    lguId: defaultLgu,
    regionId: defaultRegion,
    pin: '',
  };
}

function draftFrom(account: Profile): Draft {
  return {
    officerId: account.officer_id || '',
    fullName: account.full_name || '',
    role: account.role,
    lguId: account.lgu_id || '',
    regionId: account.region_id || '',
    pin: '',
  };
}

export function suggestOfficerId(role: Role, accounts: Profile[]): string {
  const prefix =
    role === 'cenro' ? 'CENRO' :
    role === 'lgu_admin' ? 'ADM' :
    role === 'lgu_exec' ? 'EXEC' :
    role === 'regional_exec' ? 'REG' :
    role === 'national_admin' ? 'NAT' :
    role === 'national_exec' ? 'NEX' :
    'DEV';
  const nums = accounts
    .map((a) => (a.officer_id || '').toUpperCase())
    .filter((id) => id.startsWith(prefix))
    .map((id) => parseInt(id.slice(prefix.length).replace(/\D/g, ''), 10))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(2, '0')}`;
}

export function OpsUsersPanel({
  me,
  accounts,
  lgus,
  regions,
  busy,
  setBusy,
  onChange,
}: {
  me: Profile;
  accounts: Profile[];
  lgus: Lgu[];
  regions: Region[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onChange: (next: Profile[]) => void;
}) {
  const defaultLgu = me.lgu_id || lgus.find((l) => l.name === 'Taguig')?.id || lgus[0]?.id || '';
  const defaultRegion = me.region_id || lgus.find((l) => l.id === defaultLgu)?.region_id || regions[0]?.id || '';
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(() => blankDraft('cenro', accounts, defaultLgu, defaultRegion));
  const [suggested, setSuggested] = useState(true);
  const [prompt, setPrompt] = useState<
    | { kind: 'pin' | 'delete' }
    | { kind: 'blocked'; lines: string[] }
    | null
  >(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const rows = !query
      ? accounts
      : accounts.filter((a) =>
          [a.officer_id, a.full_name, a.role, ROLE_LABEL[a.role]]
            .join(' ')
            .toLowerCase()
            .includes(query)
        );
    return rows.slice().sort((a, b) => (a.officer_id || '').localeCompare(b.officer_id || ''));
  }, [accounts, q]);

  const selected = openId && openId !== 'new' ? accounts.find((a) => a.id === openId) ?? null : null;
  const lguName = (id: string | null) => lgus.find((l) => l.id === id)?.name || '—';
  const regionName = (id: string | null) => regions.find((r) => r.id === id)?.name || regions.find((r) => r.id === id)?.code || '—';

  const patchRole = (role: Role) => {
    const lgu = lgus.find((l) => l.id === (draft.lguId || defaultLgu));
    setDraft((d) => ({
      ...d,
      role,
      officerId: suggested ? suggestOfficerId(role, accounts) : d.officerId,
      lguId: roleNeedsLgu(role) ? d.lguId || defaultLgu : d.lguId,
      regionId: roleNeedsRegion(role) ? d.regionId || lgu?.region_id || defaultRegion : d.regionId,
    }));
  };

  const openNew = () => {
    setOpenId('new');
    setSuggested(true);
    setDraft(blankDraft('cenro', accounts, defaultLgu, defaultRegion));
  };

  const openAccount = (a: Profile) => {
    setOpenId(a.id);
    setSuggested(false);
    setDraft(draftFrom(a));
  };

  const payload = () => ({
    officerId: draft.officerId,
    fullName: draft.fullName,
    role: draft.role,
    lguId: draft.lguId || null,
    regionId: draft.regionId || null,
  });

  const askSave = () => {
    if (openId === 'new') {
      if (!draft.fullName.trim()) return toast('Enter a name');
      if (!/^\d{6}$/.test(draft.pin)) return toast('PIN must be 6 digits');
    } else if (!selected) {
      return toast('Pick an account first');
    } else if (draft.pin && !/^\d{6}$/.test(draft.pin)) {
      return toast('New PIN must be 6 digits');
    }
    void save();
  };

  const askPin = () => {
    if (!selected) return toast('Pick an account first');
    if (!/^\d{6}$/.test(draft.pin)) return toast('Enter a new 6-digit PIN');
    setPrompt({ kind: 'pin' });
  };

  const askDelete = async () => {
    if (!selected) return toast('Pick an account first');
    if (selected.id === me.id) return toast('You cannot delete your own login');
    setBusy(true);
    const result = await getAccountUsage(selected.id);
    setBusy(false);
    if (result.error || !result.usage) return toast(result.error || 'Could not check this login');
    const lines = usageLines(result.usage);
    if (usageTotal(result.usage) > 0) setPrompt({ kind: 'blocked', lines });
    else setPrompt({ kind: 'delete' });
  };

  const save = async () => {
    setBusy(true);
    if (openId === 'new') {
      const result = await createAccount({ ...payload(), pin: draft.pin });
      setBusy(false);
      setPrompt(null);
      if (result.error || !result.account) return toast(result.error || 'Could not create account');
      onChange([...accounts, result.account]);
      setOpenId(null);
      toast(`Created ${normalizeOfficerId(draft.officerId)}`);
      return;
    }
    if (!selected) {
      setBusy(false);
      setPrompt(null);
      return;
    }
    const nextPin = draft.pin.trim();
    const result = await updateAccount(selected.id, {
      ...payload(),
      ...(nextPin ? { pin: nextPin } : {}),
    });
    if (result.error || !result.account) {
      setBusy(false);
      setPrompt(null);
      return toast(result.error || 'Could not update account');
    }
    setBusy(false);
    setPrompt(null);
    onChange(accounts.map((a) => (a.id === selected.id ? result.account! : a)));
    setOpenId(null);
    toast(nextPin ? 'Account updated · login PIN is now the new password' : 'Account updated');
  };

  const reset = async () => {
    if (!selected) return;
    setBusy(true);
    const result = await resetPin(selected.id, draft.pin);
    setBusy(false);
    setPrompt(null);
    if (result.error) return toast(result.error);
    setDraft((d) => ({ ...d, pin: '' }));
    toast(`PIN reset for ${selected.officer_id || 'this login'}`);
  };

  const remove = async () => {
    if (!selected) return;
    setBusy(true);
    const result = await deleteAccount(selected.id);
    setBusy(false);
    setPrompt(null);
    if (result.error) return toast(result.error);
    onChange(accounts.filter((a) => a.id !== selected.id));
    setOpenId(null);
    toast(`${selected.officer_id || 'Account'} deleted`);
  };

  return (
    <>
      <header className="pagehead pagehead--split">
        <div>
          <p className="kicker">{me.officer_id} · Access</p>
          <h1>Accounts</h1>
          <p className="sub">Create accounts, assign access roles, update info, and reset PINs. Field IDs like CENRO05 still sign in at /login.</p>
        </div>
        <button type="button" className="btn btn-primary pagehead__save" onClick={openNew}>
          + Add account
        </button>
      </header>

      <section className="sheet">
        <header className="sheet__h sheet__h--row">
          <div>
            <h3>Accounts</h3>
            <p className="sub">{accounts.length} logins · click Edit or a row to change</p>
          </div>
          <div className="ops-toolbar">
            <label className="search">
              <span className="sr">Search accounts</span>
              <input className="input" value={q} placeholder="Search ID, name, role" onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
        </header>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Scope</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className={openId === a.id ? 'is-on' : ''}
                  onClick={() => openAccount(a)}
                >
                  <td>{a.officer_id || '—'}</td>
                  <td>{a.full_name || '—'}</td>
                  <td>{ROLE_LABEL[a.role] || a.role}</td>
                  <td>
                    {roleNeedsRegion(a.role) ? regionName(a.region_id) : roleNeedsLgu(a.role) ? lguName(a.lgu_id) : 'National'}
                  </td>
                  <td className="ops-edit">
                    <button type="button" className="btn-row" onClick={(e) => { e.stopPropagation(); openAccount(a); }}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {openId && (
        <FormModal
          kicker={openId === 'new' ? 'Create' : 'Edit'}
          title={openId === 'new' ? 'Add account' : `Edit ${selected?.officer_id || 'account'}`}
          message={
            openId === 'new'
              ? `Login email will be ${loginToEmail(draft.officerId || 'ID')}`
              : selected
                ? `Signs in with ID ${selected.officer_id}`
                : undefined
          }
          confirmLabel={openId === 'new' ? 'Create account' : 'Save account'}
          dangerLabel={selected && selected.id !== me.id ? 'Delete' : undefined}
          asideLabel={selected ? 'Reset PIN' : undefined}
          busy={busy}
          locked={Boolean(prompt)}
          onClose={() => setOpenId(null)}
          onConfirm={askSave}
          onDanger={selected && selected.id !== me.id ? askDelete : undefined}
          onAside={selected ? askPin : undefined}
        >
          <label className="field">
            <span>Login ID</span>
            <input
              className="input"
              value={draft.officerId}
              placeholder="CENRO05"
              onChange={(e) => {
                setSuggested(false);
                setDraft((d) => ({ ...d, officerId: e.target.value.toUpperCase() }));
              }}
            />
          </label>
          <label className="field">
            <span>Full name</span>
            <input className="input" value={draft.fullName} onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))} />
          </label>
          <label className="field">
            <span>Access role</span>
            <select className="input" value={draft.role} onChange={(e) => patchRole(e.target.value as Role)}>
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </select>
          </label>
          {roleNeedsLgu(draft.role) && (
            <label className="field">
              <span>LGU</span>
              <select className="input" value={draft.lguId} onChange={(e) => setDraft((d) => ({ ...d, lguId: e.target.value }))}>
                <option value="">Select LGU</option>
                {lgus.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {roleNeedsRegion(draft.role) && (
            <label className="field">
              <span>Region</span>
              <select className="input" value={draft.regionId} onChange={(e) => setDraft((d) => ({ ...d, regionId: e.target.value }))}>
                <option value="">Select region</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code ? `${r.code} · ${r.name}` : r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>{openId === 'new' ? 'PIN (this is the login password)' : 'New PIN (updates the login password)'}</span>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={draft.pin}
              placeholder="203010"
              onChange={(e) => setDraft((d) => ({ ...d, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
            />
          </label>
        </FormModal>
      )}

      {prompt?.kind === 'pin' && selected && (
        <ConfirmModal
          kicker="Reset PIN"
          title="Are you sure?"
          message={`This replaces the PIN for ${selected.officer_id || 'this login'} immediately.`}
          confirmLabel="Reset PIN"
          danger
          busy={busy}
          onClose={() => setPrompt(null)}
          onConfirm={reset}
        />
      )}
      {prompt?.kind === 'delete' && selected && (
        <ConfirmModal
          kicker="Delete login"
          title="Are you sure?"
          message={`${selected.officer_id || 'This login'} has no collections, payments, or feedback attached. This permanently removes the account.`}
          confirmLabel="Delete account"
          danger
          busy={busy}
          onClose={() => setPrompt(null)}
          onConfirm={remove}
        />
      )}
      {prompt?.kind === 'blocked' && selected && (
        <ConfirmModal
          kicker="Cannot delete"
          title="This login has connected data"
          message={`${selected.officer_id || 'This account'} still has records attached. Remove those rows in Database first — deleting the login would break them.`}
          blocked
          onClose={() => setPrompt(null)}
        >
          <dl className="modal__facts">
            {prompt.lines.map((line) => (
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
