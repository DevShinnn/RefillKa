'use client';

import Link from 'next/link';
import { Wordmark } from './Brand';

export type OpsTab = 'overview' | 'users' | 'stores' | 'inventory' | 'collections' | 'reorders' | 'feedback' | 'report' | 'database';

function IconOverview() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

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

function IconInventory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8H3l2-4h14l2 4Z" />
      <path d="M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function IconCollections() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 15h3M15 15h3" />
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

function IconDatabase() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
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

function IconField() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10.5V20h16V10.5" />
      <path d="M3 10.5l2.2-5.2A2 2 0 0 1 7.05 4h9.9a2 2 0 0 1 1.85 1.3L21 10.5" />
      <path d="M8 20v-5h8v5" />
    </svg>
  );
}

const NAV: { id: OpsTab; label: string; icon: typeof IconOverview; divide?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: IconOverview },
  { id: 'users', label: 'Accounts', icon: IconUsers, divide: true },
  { id: 'stores', label: 'Stores', icon: IconStores },
  { id: 'inventory', label: 'Inventory', icon: IconInventory },
  { id: 'collections', label: 'Collections', icon: IconCollections },
  { id: 'reorders', label: 'Reorders', icon: IconReorders, divide: true },
  { id: 'feedback', label: 'Feedback', icon: IconFeedback },
  { id: 'report', label: 'Report', icon: IconReport },
  { id: 'database', label: 'Database', icon: IconDatabase, divide: true },
];

export function OpsSidebar({
  open,
  tab,
  collectionCount,
  reorderCount,
  feedbackCount,
  onGo,
  onToggle,
}: {
  open: boolean;
  tab: OpsTab;
  collectionCount: number;
  reorderCount: number;
  feedbackCount: number;
  onGo: (tab: OpsTab) => void;
  onToggle: () => void;
}) {
  return (
    <aside className={`sidebar sidebar--ops${open ? ' is-open' : ''}`} aria-label="Operations">
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
      <nav className="sidebar__nav">
        {NAV.map((item) => {
          const Icon = item.icon;
          const badge =
            (item.id === 'collections' && collectionCount > 0 && collectionCount) ||
            (item.id === 'reorders' && reorderCount > 0 && reorderCount) ||
            (item.id === 'feedback' && feedbackCount > 0 && feedbackCount);
          return (
            <div key={item.id} className={item.divide ? 'sidebar__block' : undefined}>
              {item.divide ? <hr className="sidebar__rule" /> : null}
              <button
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
                {badge ? <span className="sidebar__n">{badge}</span> : null}
              </button>
            </div>
          );
        })}
      </nav>
      <div className="sidebar__foot">
        <Link href="/log" title="Open field CRM">
          <span className="sidebar__ico">
            <IconField />
          </span>
          <span className="sidebar__label">Field CRM</span>
        </Link>
      </div>
    </aside>
  );
}
