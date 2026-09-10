'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type FilterOption = { value: string; label: string; group?: string };

export function FilterMenu({
  id,
  openId,
  setOpenId,
  label,
  value,
  options,
  onChange,
  searchable = false,
  placeholder,
}: {
  id: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  placeholder?: string;
}) {
  const open = openId === id;
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const current = options.find((o) => o.value === value)?.label || value || placeholder || label;
  const empty = !value;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const onDoc = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    if (searchable) queueMicrotask(() => searchRef.current?.focus());
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, searchable, setOpenId]);

  const items: ReactNode[] = [];
  let lastGroup: string | undefined;
  for (const o of visible) {
    if (o.group && o.group !== lastGroup) {
      lastGroup = o.group;
      items.push(
        <li key={`g-${o.group}`} className="fmenu__group">
          {o.group}
        </li>
      );
    }
    items.push(
      <li key={o.value}>
        <button
          type="button"
          role="option"
          aria-selected={o.value === value}
          className={o.value === value ? 'is-on' : ''}
          onClick={() => {
            onChange(o.value);
            setOpenId(null);
          }}
        >
          {o.label}
        </button>
      </li>
    );
  }

  return (
    <div className={`fmenu${open ? ' is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className={`fmenu__btn${open ? ' is-open' : ''}${empty ? ' is-empty' : ''}`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpenId(open ? null : id)}
      >
        <span>{current}</span>
      </button>
      {open && (
        <div className="fmenu__pop">
          {searchable && (
            <input
              ref={searchRef}
              className="fmenu__q"
              value={query}
              placeholder={`Search ${label.toLowerCase()}`}
              aria-label={`Search ${label.toLowerCase()}`}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <ul className="fmenu__list" role="listbox" aria-label={label}>
            {items.length ? items : <li className="fmenu__empty">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
