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
  { id: 'refill', label: 'Refill dispensed', unit: 'gal', color: '#2390C9', sachetEquiv: 23 },
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

export type StoreClassification = 'sari_sari' | 'independent_reseller';
export type PayPlan = 'installment' | 'fully_paid';

export interface Store {
  id: string;
  lgu_id: string;
  name: string;
  store_code: string;
  arrp_id: string;
  classification: StoreClassification;
  pay_plan: PayPlan;
  claimed_on: string | null;
  first_name: string;
  last_name: string;
  dob: string | null;
  city: string;
  barangay: string;
  address: string;
  house_no: string;
  street: string;
  village: string;
  hoa: string;
  district: string;
  zip: string;
  phone: string;
  phone_alt: string;
  contact_person: string;
  contact_phone: string;
  email: string;
  facebook: string;
  facebook_alt: string;
  maps_url: string;
  age: number | null;
  gender: 'F' | 'M' | null;
  will_reorder: boolean | null;
  feedback_product: string;
  feedback_service: string;
  channel: string;
  active: boolean;
  created_at: string;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name: string;
}

/** First-kit installment collected from each store (₱550 × 9 weeks). After this they only refill. */
export const WEEKLY_INSTALLMENT = 550;

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  region_id: string | null;
  lgu_id: string | null;
  officer_id: string | null;
  created_at: string;
}

export type ProductCategory = 'food' | 'nonfood';

export interface Product {
  id: string;
  category: ProductCategory;
  name: string;
  pack_qty: string;
  price_refill: number;
  price_with_container: number;
  active: boolean;
  sort_order: number;
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
  product_id: string | null;
  with_container: boolean;
  is_reorder: boolean;
  unit_price: number | null;
  logged_by: string;
  logged_by_name: string;
  logged_by_role: Role;
  collected_at: string;
  created_at: string;
}

export function productPrice(p: Product, withContainer: boolean): number {
  return Number(withContainer ? p.price_with_container : p.price_refill);
}

export function productById(products: Product[], id: string | null | undefined): Product | undefined {
  if (!id) return undefined;
  return products.find((p) => p.id === id);
}

export function toSachetEquiv(c: Pick<Collection, 'material' | 'quantity'>): number {
  return materialById(c.material).sachetEquiv * Number(c.quantity || 0);
}

export interface Payment {
  id: string;
  store_id: string;
  lgu_id: string;
  region_id: string;
  amount: number;
  paid_on: string;
  week_start: string;
  notes: string;
  logged_by: string;
  logged_by_name: string;
  logged_by_role: Role;
  created_at: string;
}

export type FeedbackTopic = 'product' | 'service' | 'general';
export type AppFeedbackTopic = 'suggestion' | 'bug' | 'other';

export interface StoreFeedback {
  id: string;
  store_id: string;
  lgu_id: string;
  region_id: string;
  topic: FeedbackTopic;
  note: string;
  logged_by: string;
  logged_by_name: string;
  logged_by_role: Role;
  created_at: string;
}

export interface AppFeedback {
  id: string;
  lgu_id: string | null;
  region_id: string | null;
  topic: AppFeedbackTopic;
  note: string;
  logged_by: string;
  logged_by_name: string;
  logged_by_role: Role;
  created_at: string;
}

export interface FeedbackReply {
  id: string;
  store_feedback_id: string | null;
  app_feedback_id: string | null;
  note: string;
  logged_by: string;
  logged_by_name: string;
  logged_by_role: Role;
  created_at: string;
}
