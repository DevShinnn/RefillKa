'use client';

import type { ReactNode } from 'react';

export function ConfirmModal({
  title = 'Are you sure?',
  kicker = 'Confirm',
  message,
  confirmLabel = 'Yes, continue',
  cancelLabel = 'Cancel',
  danger = false,
  blocked = false,
  busy = false,
  children,
  onClose,
  onConfirm,
}: {
  title?: string;
  kicker?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  blocked?: boolean;
  busy?: boolean;
  children?: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
}) {
  return (
    <div className="modal modal--front" role="dialog" aria-modal="true" aria-label={title}>
      <button className="modal__scrim" type="button" aria-label="Cancel" onClick={() => !busy && onClose()} />
      <div className="modal__card">
        <header className="modal__head">
          <p className={`kicker${danger || blocked ? ' kicker--danger' : ''}`}>{kicker}</p>
          <h3>{title}</h3>
          <p className="sub">{message}</p>
        </header>
        {children}
        <div className="modal__actions">
          {blocked ? (
            <button className="btn btn-primary" type="button" onClick={onClose}>
              Close
            </button>
          ) : (
            <>
              <button className="btn-ghost" type="button" disabled={busy} onClick={onClose}>
                {cancelLabel}
              </button>
              <button
                className={danger ? 'btn btn-danger' : 'btn btn-primary'}
                type="button"
                disabled={busy}
                onClick={onConfirm}
              >
                {busy ? 'Working…' : confirmLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
