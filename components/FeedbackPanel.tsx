'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { tstamp } from '@/lib/format';
import { useAppFeedback } from '@/lib/hooks/useAppFeedback';
import { repliesFor, useFeedbackReplies } from '@/lib/hooks/useFeedbackReplies';
import type { AppFeedback, AppFeedbackTopic, Profile } from '@/lib/types';
import { Empty, toast } from './ui';

function topicLabel(topic: AppFeedbackTopic): string {
  if (topic === 'bug') return 'Bug';
  if (topic === 'other') return 'Other';
  return 'Suggestion';
}

export function FeedbackPanel({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const { rows, setRows } = useAppFeedback();
  const { rows: replies } = useFeedbackReplies();
  const [topic, setTopic] = useState<AppFeedbackTopic>('suggestion');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<AppFeedback | null>(null);

  const post = async () => {
    const text = note.trim();
    if (!text) return toast('Write a suggestion first');
    setBusy(true);
    const { data, error } = await supabase
      .from('app_feedback')
      .insert({
        topic,
        note: text,
        logged_by: profile.id,
        logged_by_role: profile.role,
      })
      .select('*')
      .single();
    setBusy(false);
    if (error || !data) {
      toast(
        /app_feedback|schema cache|does not exist/i.test(error?.message || '')
          ? 'Feedback table is not set up yet. Apply migration 0010_app_feedback.sql.'
          : error?.message || 'Could not send'
      );
      return;
    }
    setRows((prev) => [data as AppFeedback, ...prev.filter((r) => r.id !== data.id)]);
    setNote('');
    toast('Suggestion sent');
  };

  const confirmDelete = async () => {
    if (!remove) return;
    setBusy(true);
    const { error } = await supabase.from('app_feedback').delete().eq('id', remove.id);
    setBusy(false);
    if (error) {
      toast('Could not delete');
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== remove.id));
    setRemove(null);
    toast('Removed');
  };

  return (
    <>
      <header className="pagehead">
        <p className="kicker">CENRO</p>
        <h1>Feedback</h1>
        <p className="sub">Suggest improvements, report a bug, or tell us what is slowing you down in the field.</p>
      </header>

      <div className="feedback-board">
      <section className="sheet">
        <header className="sheet__h">
          <p className="kicker">Website</p>
          <h3>Send a suggestion</h3>
        </header>
        <div className="seg seg--3">
          <button type="button" className={topic === 'suggestion' ? 'is-on' : ''} onClick={() => setTopic('suggestion')}>
            Suggestion
          </button>
          <button type="button" className={topic === 'bug' ? 'is-on' : ''} onClick={() => setTopic('bug')}>
            Bug
          </button>
          <button type="button" className={topic === 'other' ? 'is-on' : ''} onClick={() => setTopic('other')}>
            Other
          </button>
        </div>
        <label className="field">
          <span>Your note</span>
          <textarea
            className="input"
            rows={4}
            placeholder="What should we change or fix?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button className="btn btn-primary btn-add" type="button" disabled={busy} onClick={post}>
          {busy ? 'Sending…' : 'Send'}
        </button>
      </section>

      <section className="sheet">
        <header className="sheet__h">
          <p className="kicker">{profile.role === 'superadmin' ? 'Inbox' : 'Yours'}</p>
          <h3>{profile.role === 'superadmin' ? 'All suggestions' : 'Sent notes'}</h3>
        </header>
        {rows.length ? (
          <div className="feed">
            {rows.map((row) => (
              <article className="feedpost" key={row.id}>
                <div className="feedpost__top">
                  <span className={`chip ${row.topic === 'bug' ? 'chip--due' : row.topic === 'other' ? 'chip--pending' : 'chip--ok'}`}>
                    {topicLabel(row.topic)}
                  </span>
                  {(row.logged_by === profile.id || profile.role === 'superadmin') && (
                    <button className="iconbtn iconbtn--danger" type="button" disabled={busy} onClick={() => setRemove(row)}>
                      Delete
                    </button>
                  )}
                </div>
                <p className="feedpost__note">{row.note}</p>
                <p className="feedpost__meta">
                  {row.logged_by_name ? `${row.logged_by_name} · ` : ''}
                  {tstamp(row.created_at)}
                </p>
                {repliesFor(replies, 'app', row.id).map((r) => (
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
          <Empty msg="No suggestions yet." />
        )}
      </section>
      </div>

      {remove && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Delete suggestion">
          <button className="modal__scrim" type="button" aria-label="Cancel" onClick={() => !busy && setRemove(null)} />
          <div className="modal__card">
            <header className="modal__head">
              <p className="kicker">Remove</p>
              <h3>Delete this note?</h3>
              <p className="sub">This cannot be undone.</p>
            </header>
            <div className="modal__actions">
              <button className="btn-ghost" type="button" disabled={busy} onClick={() => setRemove(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" disabled={busy} onClick={confirmDelete}>
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
