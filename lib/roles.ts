export type Role =
  | 'superadmin'
  | 'cenro'
  | 'lgu_admin'
  | 'lgu_exec'
  | 'regional_exec'
  | 'national_admin'
  | 'national_exec';

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: 'Superadmin · Developer',
  cenro: 'CENRO Staff',
  lgu_admin: 'LGU Admin',
  lgu_exec: 'Executive · LGU',
  regional_exec: 'Executive · Region',
  national_admin: 'National Admin',
  national_exec: 'Executive · National',
};

export const isAdmin = (r: Role | null) =>
  r === 'lgu_admin' || r === 'national_admin' || r === 'superadmin';
export const isExec = (r: Role | null) =>
  r === 'lgu_exec' || r === 'regional_exec' || r === 'national_exec';

/** Landing route for each role after login. */
export function homeForRole(role: Role | null): string {
  switch (role) {
    case 'cenro':
      return '/log';
    case 'lgu_admin':
    case 'national_admin':
    case 'superadmin':
      return '/admin';
    case 'lgu_exec':
    case 'regional_exec':
    case 'national_exec':
      return '/executive';
    default:
      return '/login';
  }
}

/** Which roles may open which route prefix. Superadmin may open everything. */
const ACCESS: Record<string, Role[]> = {
  '/log': ['superadmin', 'cenro', 'lgu_admin', 'national_admin'],
  '/admin': ['superadmin', 'lgu_admin', 'national_admin'],
  '/executive': ['superadmin', 'lgu_exec', 'regional_exec', 'national_exec', 'national_admin'],
};

export function canAccess(role: Role | null, path: string): boolean {
  if (!role) return false;
  const key = Object.keys(ACCESS).find((p) => path === p || path.startsWith(p + '/'));
  if (!key) return true; // unguarded route
  return ACCESS[key].includes(role);
}
