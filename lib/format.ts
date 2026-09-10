export const fmt = (n: number): string =>
  Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 });

export const peso = (n: number): string =>
  '₱' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 0 });

/** Manila-local, human timestamp. */
export function tstamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function isToday(iso: string): boolean {
  const t = new Date(iso);
  const n = new Date();
  return (
    t.getFullYear() === n.getFullYear() &&
    t.getMonth() === n.getMonth() &&
    t.getDate() === n.getDate()
  );
}

/** Monday of the ISO week for a YYYY-MM-DD date (Manila-local calendar day). */
export function isoWeekStart(ymd?: string): string {
  const parts = (ymd || manilaYmd()).split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const offset = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function manilaYmd(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
}

export function manilaDateLabel(d = new Date()): string {
  return d.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function manilaTimeLabel(d = new Date()): string {
  return d.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
