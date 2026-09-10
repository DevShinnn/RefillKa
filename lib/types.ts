import type { Role } from './roles';

export type MaterialId = 'sachet' | 'refill' | 'pet' | 'hdpe' | 'ucoil' | 'reuse';

export interface Material {
  id: MaterialId;
  label: string;
  unit: string;
  color: string;
  /** Weighting to a common "sachet-equivalent diverted" headline metric. */
  sachetEquiv: number;
}

export const MATERIALS: Material[] = [
  { id: 'sachet', label: 'Sachets diverted (equiv.)', unit: 'pcs', color: '#DC2F29', sachetEquiv: 1 },
  { id: 'refill', label: 'Refill dispensed', unit: 'L', color: '#2390C9', sachetEquiv: 6 },
  { id: 'pet', label: 'PET bottles collected', unit: 'pcs', color: '#5DAA40', sachetEquiv: 2 },
  { id: 'hdpe', label: 'HDPE / mixed plastic', unit: 'kg', color: '#2A7C78', sachetEquiv: 120 },
  { id: 'ucoil', label: 'Used cooking oil', unit: 'L', color: '#B8860B', sachetEquiv: 8 },
  { id: 'reuse', label: 'Reusable containers back', unit: 'pcs', color: '#8a6d04', sachetEquiv: 3 },
];

export const materialById = (id: string): Material =>
  MATERIALS.find((m) => m.id === id) ?? {
    id: id as MaterialId,
    label: id,
    unit: '',
    color: '#888',
    sachetEquiv: 1,
  };

/** Field-study target, in sachet-equivalent diversion units. */
export const PILOT_TARGET = 100_000;

export interface Region {
  id: string;
  code: string;
  name: string;
}

export interface Lgu {
  id: string;
  region_id: string;
  name: string;
  kind: string;
}

export interface Store {
  id: string;
  lgu_id: string;
  name: string;
  barangay: string;
  channel: string;
  active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  region_id: string | null;
  lgu_id: string | null;
  created_at: string;
}

export interface Collection {
  id: string;
  store_id: string;
  lgu_id: string;
  region_id: string;
  material: MaterialId;
  quantity: number;
  unit: string;
  notes: string;
  logged_by: string;
  logged_by_name: string;
  logged_by_role: Role;
  collected_at: string;
  created_at: string;
}

export function toSachetEquiv(c: Pick<Collection, 'material' | 'quantity'>): number {
  return materialById(c.material).sachetEquiv * Number(c.quantity || 0);
}
