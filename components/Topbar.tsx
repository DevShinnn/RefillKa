'use client';

import { RefillMark, Wordmark } from './Brand';
import { signOut } from '@/app/login/actions';
import type { LiveStatus } from '@/lib/hooks/useCollections';
import { ROLE_LABEL, type Role } from '@/lib/roles';

const STATUS_TEXT: Record<LiveStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  offline: 'Offline',
};

export function Topbar({
  role,
  name,
  meta,
  status,
}: {
  role: Role;
  name: string;
  meta: string;
  status: LiveStatus;
}) {
  const toggleTheme = () => {
    const el = document.documentElement;
    const cur = el.getAttribute('data-theme');
    const dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    el.setAttribute('data-theme', next);
    try {
      localStorage.setItem('refillka_theme', next);
    } catch {}
  };

  return (
    <header className="topbar">
      <div className="topbar__in">
        <RefillMark size={30} />
        <div style={{ fontSize: '1.25rem' }}>
          <Wordmark />
        </div>
        <span className="by">Taguig Field Study</span>
        <span className="rolechip">
          <span className="dot" />
          {ROLE_LABEL[role]}
        </span>

        <div className="spacer" />

        <div className="livewrap" title={`Realtime: ${STATUS_TEXT[status]}`}>
          <span className={`livedot ${status}`} />
          {STATUS_TEXT[status]}
        </div>
        <div className="who">
          <span className="n">{name}</span>
          <span className="r">{meta}</span>
        </div>

        <button className="iconbtn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </button>
        <form action={signOut}>
          <button className="iconbtn" type="submit" title="Sign out" aria-label="Sign out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </form>
      </div>
    </header>
  );
}
