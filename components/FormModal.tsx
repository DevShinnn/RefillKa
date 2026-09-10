'use client';

import { type FormEvent, type ReactNode, useEffect } from 'react';

export function FormModal({
  kicker,
  title,
  message,
  children,
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  dangerLabel,
  asideLabel,
  busy = false,
  locked = false,
  wide = false,
  onClose,
  onConfirm,
  onDanger,
  onAside,
}: {
  kicker: string;
  title: string;
  message?: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  dangerLabel?: string;
  asideLabel?: string;
  busy?: boolean;
  locked?: boolean;
  wide?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDanger?: () => void;
  onAside?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy && !locked) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [busy, locked, onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy && !locked) onConfirm();
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <button className="modal__scrim" type="button" aria-label="Close" onClick={() => !busy && !locked && onClose()} />
      <form className={`modal__card modal__card--form${wide ? ' is-wide' : ''}`} onSubmit={submit}>
        <header className="modal__head">
          <p className="kicker">{kicker}</p>
          <h3>{title}</h3>
          {message ? <p className="sub">{message}</p> : null}
        </header>
        <div className="modal__body">{children}</div>
        <div className="modal__actions">
          {dangerLabel && onDanger ? (
            <button type="button" className="btn btn-danger" disabled={busy || locked} onClick={onDanger}>
              {dangerLabel}
            </button>
          ) : null}
          {asideLabel && onAside ? (
            <button type="button" className="btn-ghost" disabled={busy || locked} onClick={onAside}>
              {asideLabel}
            </button>
          ) : null}
          <button type="button" className="btn-ghost" disabled={busy || locked} onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || locked}>
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
