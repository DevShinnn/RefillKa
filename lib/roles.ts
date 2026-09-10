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

export const ASSIGNABLE_ROLES: Role[] = [
  'cenro',
  'lgu_admin',
  'lgu_exec',
  'regional_exec',
  'national_admin',
  'national_exec',
  'superadmin',
];

export function roleNeedsLgu(role: Role) {
  return role === 'cenro' || role === 'lgu_admin' || role === 'lgu_exec';
}

export function roleNeedsRegion(role: Role) {
  return role === 'regional_exec';
}

export const isAdmin = (r: Role | null) =>
  r === 'lgu_admin' || r === 'national_admin' || r === 'superadmin';
export const isExec = (r: Role | null) =>
  r === 'lgu_exec' || r === 'regional_exec' || r === 'national_exec';
export const isDeveloper = (r: Role | null) => r === 'superadmin';
export const isFieldRole = (r: Role | null) => r === 'cenro';
export const isOpsRole = (r: Role | null) => Boolean(r) && r !== 'cenro';

export const FIELD_LOGIN = '/login';
export const OPS_LOGIN = '/ops';

export function loginPathFor(path: string): string {
  if (
    path === '/ops' ||
    path.startsWith('/ops/') ||
    path === '/dev' ||
    path.startsWith('/dev/') ||
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/executive' ||
    path.startsWith('/executive/')
  ) {
    return OPS_LOGIN;
  }
  return FIELD_LOGIN;
}

/** Landing route for each role after login. */
export function homeForRole(role: Role | null): string {
  switch (role) {
    case 'cenro':
      return '/log';
    case 'lgu_admin':
    case 'national_admin':
      return '/admin';
    case 'superadmin':
      return '/ops';
    case 'lgu_exec':
    case 'regional_exec':
    case 'national_exec':
      return '/executive';
    default:
      return FIELD_LOGIN;
  }
}

/** Which roles may open which route prefix. Superadmin may open everything. */
const ACCESS: Record<string, Role[]> = {
  '/log': ['superadmin', 'cenro', 'lgu_admin', 'national_admin'],
  '/admin': ['superadmin', 'lgu_admin', 'national_admin'],
  '/ops': ['superadmin'],
  '/dev': ['superadmin'],
  '/executive': ['superadmin', 'lgu_exec', 'regional_exec', 'national_exec', 'national_admin'],
};

export function canAccess(role: Role | null, path: string): boolean {
  if (!role) return false;
  const key = Object.keys(ACCESS).find((p) => path === p || path.startsWith(p + '/'));
  if (!key) return true; // unguarded route
  return ACCESS[key].includes(role);
}
