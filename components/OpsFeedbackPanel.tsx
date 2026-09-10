'use client';

import { useState } from 'react';
import { persistFeedbackReply } from '@/app/ops/actions';
import { tstamp } from '@/lib/format';
import { repliesFor } from '@/lib/hooks/useFeedbackReplies';
import { storeDisplayName } from '@/lib/storeProfile';
import type { AppFeedback, FeedbackReply, Profile, Store, StoreFeedback } from '@/lib/types';
import { FormModal } from './FormModal';
import { Empty, toast } from './ui';

type Source = 'stores' | 'cenro';

function storeTopic(topic: StoreFeedback['topic']) {
  if (topic === 'product') return 'Product';
  if (topic === 'service') return 'Service';
  return 'General';
}

function appTopic(topic: AppFeedback['topic']) {
  if (topic === 'bug') return 'Bug';
  if (topic === 'other') return 'Other';
  return 'Suggestion';
}

export function OpsFeedbackPanel({
  profile,
  stores,
  storeNotes,
  cenroNotes,
  replies,
  setReplies,
  busy,
  setBusy,
}: {
  profile: Profile;
  stores: Store[];
  storeNotes: StoreFeedback[];
  cenroNotes: AppFeedback[];
  replies: FeedbackReply[];
  setReplies: (next: FeedbackReply[] | ((prev: FeedbackReply[]) => FeedbackReply[])) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const [source, setSource] = useState<Source>('stores');
  const [q, setQ] = useState('');
  const [openStoreId, setOpenStoreId] = useState<string | null>(null);
  const [openCenroId, setOpenCenroId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const storeName = (id: string) => {
    const s = stores.find((x) => x.id === id);
    return s ? storeDisplayName(s) : 'Store';
  };

  const query = q.trim().toLowerCase();
  const filteredStores = storeNotes.filter(
    (r) => !query || [storeName(r.store_id), r.note, r.logged_by_name, r.topic].join(' ').toLowerCase().includes(query)
  );
  const filteredCenro = cenroNotes.filter(
    (r) => !query || [r.note, r.logged_by_name, r.topic].join(' ').toLowerCase().includes(query)
  );

  const openStore = storeNotes.find((r) => r.id === openStoreId) ?? null;
  const openCenro = cenroNotes.find((r) => r.id === openCenroId) ?? null;
  const openId = source === 'stores' ? openStoreId : openCenroId;
  const thread = openId ? repliesFor(replies, source === 'stores' ? 'store' : 'app', openId) : [];
  const unrepliedStores = storeNotes.filter((r) => repliesFor(replies, 'store', r.id).length === 0).length;
  const unrepliedCenro = cenroNotes.filter((r) => repliesFor(replies, 'app', r.id).length === 0).length;

  const askSend = () => {
    if (!openId) return;
    if (!draft.trim()) return toast('Write a reply first');
    void send();
  };

  const closeThread = () => {
    setOpenStoreId(null);
    setOpenCenroId(null);
    setDraft('');
  };

  const send = async () => {
    if (!openId) return;
    const note = draft.trim();
    if (!note) return;
    setBusy(true);
    const result = await persistFeedbackReply(
      source === 'stores'
        ? { storeFeedbackId: openId, note }
        : { appFeedbackId: openId, note }
    );
    setBusy(false);
    if (result.error || !result.reply) {
      toast(
        /feedback_replies|schema cache|does not exist/i.test(result.error || '')
          ? 'Reply table is missing. Apply migration 0012_feedback_replies.sql.'
          : result.error || 'Could not send reply'
      );
      return;
    }
    setReplies((prev) => [...prev.filter((r) => r.id !== result.reply!.id), result.reply!]);
    setDraft('');
    toast('Reply sent');
  };

  const listEmpty = source === 'stores' ? filteredStores.length === 0 : filteredCenro.length === 0;

  return (
    <>
      <header className="pagehead">
        <p className="kicker">{profile.officer_id} · Inbox</p>
        <h1>Feedback</h1>
        <p className="sub">Store visit notes and CENRO website suggestions. Reply here — they see it in the field app.</p>
      </header>

      <div className="ops-dbtabs">
        <button
          type="button"
          className={source === 'stores' ? 'is-on' : ''}
          onClick={() => { setSource('stores'); setQ(''); }}
        >
          Stores
          <span>{storeNotes.length}</span>
        </button>
        <button
          type="button"
          className={source === 'cenro' ? 'is-on' : ''}
          onClick={() => { setSource('cenro'); setQ(''); }}
        >
          CENRO
          <span>{cenroNotes.length}</span>
        </button>
      </div>

      <section className="sheet">
        <header className="sheet__h sheet__h--row">
          <div>
            <h3>{source === 'stores' ? 'Store notes' : 'CENRO suggestions'}</h3>
            <p className="sub">
              {source === 'stores' ? `${unrepliedStores} waiting for a reply` : `${unrepliedCenro} waiting for a reply`}
              {' · click a note to reply'}
            </p>
          </div>
          <div className="ops-toolbar">
            <label className="search">
              <span className="sr">Search feedback</span>
              <input className="input" value={q} placeholder="Search notes" onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
        </header>
        {listEmpty ? (
          <Empty msg={source === 'stores' ? 'No store feedback yet.' : 'No CENRO suggestions yet.'} />
        ) : (
          <ul className="issue-list">
            {source === 'stores'
              ? filteredStores.map((row) => {
                  const waiting = repliesFor(replies, 'store', row.id).length === 0;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={openStoreId === row.id ? 'is-on' : ''}
                        onClick={() => { setOpenStoreId(row.id); setOpenCenroId(null); setDraft(''); }}
                      >
                        <strong>
                          {storeName(row.store_id)}
                          {waiting ? ' · Needs reply' : ''}
                        </strong>
                        <span>
                          {storeTopic(row.topic)} · {row.logged_by_name || 'CENRO'} · {tstamp(row.created_at)}
                        </span>
                        <span>{row.note}</span>
                      </button>
                    </li>
                  );
                })
              : filteredCenro.map((row) => {
                  const waiting = repliesFor(replies, 'app', row.id).length === 0;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={openCenroId === row.id ? 'is-on' : ''}
                        onClick={() => { setOpenCenroId(row.id); setOpenStoreId(null); setDraft(''); }}
                      >
                        <strong>
                          {row.logged_by_name || 'CENRO'}
                          {waiting ? ' · Needs reply' : ''}
                        </strong>
                        <span>
                          {appTopic(row.topic)} · {tstamp(row.created_at)}
                        </span>
                        <span>{row.note}</span>
                      </button>
                    </li>
                  );
                })}
          </ul>
        )}
      </section>

      {(openStore || openCenro) && (
        <FormModal
          wide
          kicker={source === 'stores' && openStore ? storeTopic(openStore.topic) : openCenro ? appTopic(openCenro.topic) : 'Reply'}
          title={
            source === 'stores' && openStore
              ? storeName(openStore.store_id)
              : openCenro?.logged_by_name || 'CENRO'
          }
          message={`${(source === 'stores' ? openStore?.logged_by_name : openCenro?.logged_by_name) ? `${source === 'stores' ? openStore?.logged_by_name : openCenro?.logged_by_name} · ` : ''}${tstamp((source === 'stores' ? openStore?.created_at : openCenro?.created_at) || '')}`}
          confirmLabel="Send reply"
          busy={busy}
          onClose={closeThread}
          onConfirm={askSend}
        >
          <article className="feedpost">
            <p className="feedpost__note">{source === 'stores' ? openStore?.note : openCenro?.note}</p>
          </article>
          {thread.length > 0 && (
            <div className="feed" style={{ marginTop: 12 }}>
              {thread.map((r) => (
                <article className="feedpost feedpost--reply" key={r.id}>
                  <p className="feedpost__note">{r.note}</p>
                  <p className="feedpost__meta">
                    {r.logged_by_name || 'Ops'} · {tstamp(r.created_at)}
                  </p>
                </article>
              ))}
            </div>
          )}
          <label className="field">
            <span>Reply</span>
            <textarea
              className="input"
              rows={4}
              placeholder="Write a reply. They will see this in the field app."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
        </FormModal>
      )}
    </>
  );
}
