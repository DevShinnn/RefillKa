'use client';

import { Wordmark } from './Brand';

export type CrmTab = 'stores' | 'reorders' | 'feedback' | 'report';

function IconStores() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10.5V20h16V10.5" />
      <path d="M3 10.5l2.2-5.2A2 2 0 0 1 7.05 4h9.9a2 2 0 0 1 1.85 1.3L21 10.5" />
      <path d="M8 20v-5h8v5" />
      <path d="M3 10.5h18" />
    </svg>
  );
}

function IconReorders() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.2-5.5" />
      <path d="M20 4v6h-6" />
    </svg>
  );
}

function IconFeedback() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-4 3.5V6.5Z" />
      <path d="M8 8.5h8M8 12h5" />
    </svg>
  );
}

function IconReport() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 17V11M12 17V7M16 17v-4" />
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

const NAV: { id: CrmTab; label: string; icon: typeof IconStores }[] = [
  { id: 'stores', label: 'Stores', icon: IconStores },
  { id: 'reorders', label: 'Reorders', icon: IconReorders },
  { id: 'feedback', label: 'Feedback', icon: IconFeedback },
  { id: 'report', label: 'Report', icon: IconReport },
];

export function Sidebar({
  open,
  tab,
  reorderCount,
  showReport = false,
  onGo,
  onToggle,
}: {
  open: boolean;
  tab: CrmTab;
  reorderCount: number;
  showReport?: boolean;
  onGo: (tab: CrmTab) => void;
  onToggle: () => void;
}) {
  const items = NAV.filter((item) => item.id !== 'report' || showReport);
  return (
    <aside className={`sidebar no-print${open ? ' is-open' : ''}`} aria-label="Sidebar">
      <div className="sidebar__head">
        <div className="sidebar__brand">
          <Wordmark />
        </div>
        <button
          className="sidebar__toggle"
          type="button"
          onClick={onToggle}
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={open}
        >
          <IconMenu />
        </button>
      </div>

      <p className="sidebar__section">Workspace</p>
      <nav className="sidebar__nav">
        {items.map((item) => {
          const Icon = item.icon;
          const badge = item.id === 'reorders' && reorderCount > 0;
          return (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'is-on' : ''}
              title={item.label}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => onGo(item.id)}
            >
              <span className="sidebar__ico">
                <Icon />
              </span>
              <span className="sidebar__label">{item.label}</span>
              {badge && <span className="sidebar__n">{reorderCount}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
