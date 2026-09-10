/** Map a public officer ID (CENRO01) or an email to the Auth email. */
export function loginToEmail(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return `${normalizeOfficerId(trimmed).toLowerCase()}@id.refillka.local`;
}

/** CENRO01 uses a zero, not the letter O. */
export function normalizeOfficerId(raw: string): string {
  let id = raw.trim().replace(/\s+/g, '').toUpperCase();
  const m = id.match(/^(CENRO)(.*)$/);
  if (m) id = `CENRO${m[2].replace(/O/g, '0')}`;
  return id;
}
