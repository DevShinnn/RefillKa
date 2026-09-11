'use client';

import { useState } from 'react';
import { signOut } from '@/app/login/actions';
import type { LiveStatus } from '@/lib/hooks/useCollections';
import { ROLE_LABEL, type Role } from '@/lib/roles';
import { RefillMark, Wordmark } from './Brand';
import { ConfirmModal } from './ConfirmModal';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || 'C';
}

export function Topbar({
  role,
  name,
  meta,
  officerId,
  heading,
  status,
  onMenu,
  menuOpen,
}: {
  role: Role;
  name: string;
  meta: string;
  officerId?: string | null;
  heading?: string;
  status?: LiveStatus;
  onMenu?: () => void;
  menuOpen?: boolean;
}) {
  const line = [officerId, ROLE_LABEL[role]].filter(Boolean).join(' · ');
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const confirmSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <header className="topbar">
      <div className="topbar__in">
        {onMenu && (
          <button
            className="iconbtn iconbtn--menu"
            type="button"
            onClick={onMenu}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        )}
        {heading ? (
          <div className="topbar__page">{heading}</div>
        ) : (
          <>
            <RefillMark size={26} />
            <div className="topbar__mark">
              <Wordmark />
            </div>
          </>
        )}
        <div className="spacer" />
        {status === 'connecting' && (
          <span className="topbar__live" aria-live="polite">
            <span className="pageload__spin pageload__spin--sm" aria-hidden="true" />
            Loading
          </span>
        )}
        <details className="profile">
          <summary className="profile__btn" title={name}>
            <span className="profile__av" aria-hidden="true">
              {initials(name)}
            </span>
            <span className="profile__text">
              <span className="n">{name}</span>
              <span className="r">{line || meta}</span>
            </span>
            <svg className="profile__caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div className="profile__menu">
            <div className="profile__menu-head">
              <span className="profile__av profile__av--lg" aria-hidden="true">
                {initials(name)}
              </span>
              <div className="profile__menu-id">
                <div className="profile__menu-name">{name}</div>
                <div className="profile__menu-meta">{ROLE_LABEL[role]}</div>
              </div>
            </div>
            <dl className="profile__facts">
              {officerId && (
                <div>
                  <dt>ID</dt>
                  <dd>{officerId}</dd>
                </div>
              )}
              {meta && (
                <div>
                  <dt>Scope</dt>
                  <dd>{meta}</dd>
                </div>
              )}
            </dl>
            <button className="profile__out" type="button" onClick={() => setSignOutOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign out
            </button>
          </div>
        </details>
      </div>
      {signOutOpen && (
        <ConfirmModal
          title="Sign out?"
          kicker="Account"
          message="Are you sure? You will need your ID and PIN to sign back in."
          confirmLabel="Sign out"
          danger
          busy={signingOut}
          onClose={() => !signingOut && setSignOutOpen(false)}
          onConfirm={confirmSignOut}
        />
      )}
    </header>
  );
}
