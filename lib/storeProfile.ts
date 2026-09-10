import { manilaYmd } from './format';
import type { PayPlan, Store, StoreClassification } from './types';

export type StoreForm = {
  name: string;
  firstName: string;
  lastName: string;
  classification: StoreClassification;
  payPlan: PayPlan;
  claimedOn: string;
  city: string;
  barangay: string;
  houseNo: string;
  street: string;
  village: string;
  hoa: string;
  district: string;
  zip: string;
  phone: string;
  phoneAlt: string;
  contactPerson: string;
  contactPhone: string;
  email: string;
  facebook: string;
  facebookAlt: string;
  mapsUrl: string;
  age: string;
  dob: string;
  gender: 'F' | 'M' | '';
};

export const CLASSIFICATION_OPTIONS: { value: StoreClassification; label: string }[] = [
  { value: 'sari_sari', label: 'Sari-sari store' },
  { value: 'independent_reseller', label: 'Independent reseller' },
];

export const PAY_PLAN_OPTIONS: { value: PayPlan; label: string }[] = [
  { value: 'installment', label: 'Installment' },
  { value: 'fully_paid', label: 'Fully paid' },
];

export function blankStoreForm(): StoreForm {
  return {
    name: '',
    firstName: '',
    lastName: '',
    classification: 'sari_sari',
    payPlan: 'installment',
    claimedOn: manilaYmd(),
    city: 'Taguig',
    barangay: '',
    houseNo: '',
    street: '',
    village: '',
    hoa: '',
    district: '',
    zip: '',
    phone: '',
    phoneAlt: '',
    contactPerson: '',
    contactPhone: '',
    email: '',
    facebook: '',
    facebookAlt: '',
    mapsUrl: '',
    age: '',
    dob: '',
    gender: '',
  };
}

export function formFromStore(store: Store): StoreForm {
  return {
    name: store.name ?? '',
    firstName: store.first_name ?? '',
    lastName: store.last_name ?? '',
    classification: store.classification === 'independent_reseller' ? 'independent_reseller' : 'sari_sari',
    payPlan: store.pay_plan === 'fully_paid' ? 'fully_paid' : 'installment',
    claimedOn: (store.claimed_on || '').slice(0, 10) || manilaYmd(),
    city: store.city || 'Taguig',
    barangay: store.barangay && store.barangay !== '—' ? store.barangay : '',
    houseNo: store.house_no ?? '',
    street: store.street ?? '',
    village: store.village ?? '',
    hoa: store.hoa ?? '',
    district: store.district ?? '',
    zip: store.zip ?? '',
    phone: store.phone ?? '',
    phoneAlt: store.phone_alt ?? '',
    contactPerson: store.contact_person ?? '',
    contactPhone: store.contact_phone ?? '',
    email: store.email ?? '',
    facebook: store.facebook ?? '',
    facebookAlt: store.facebook_alt ?? '',
    mapsUrl: store.maps_url ?? '',
    age: store.age ? String(store.age) : '',
    dob: (store.dob || '').slice(0, 10),
    gender: store.gender ?? '',
  };
}

export function ageFromDob(dob: string, on = manilaYmd()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const [Y, M, D] = on.split('-').map(Number);
  let age = Y - y;
  if (M < m || (M === m && D < d)) age -= 1;
  if (age < 1 || age > 120) return null;
  return age;
}

export function partnerName(form: Pick<StoreForm, 'firstName' | 'lastName' | 'name'>): string {
  return `${form.firstName} ${form.lastName}`.trim() || form.name.trim();
}

export function storeDisplayName(store: Pick<Store, 'name' | 'first_name' | 'last_name' | 'store_code'>): string {
  const person = `${store.first_name || ''} ${store.last_name || ''}`.trim();
  return (store.name || '').trim() || person || store.store_code || 'Store';
}

export function composeAddress(form: Pick<StoreForm, 'houseNo' | 'street' | 'village'>): string {
  return [form.houseNo, form.street, form.village].map((v) => v.trim()).filter(Boolean).join(', ');
}

export function classificationLabel(value?: string | null): string {
  if (value === 'independent_reseller') return 'Independent reseller';
  return 'Sari-sari store';
}

export function payPlanLabel(value?: string | null): string {
  if (value === 'fully_paid') return 'Fully paid';
  return 'Installment';
}

export function channelFor(classification: StoreClassification): string {
  return classification === 'independent_reseller' ? 'Independent reseller' : 'Sari-sari';
}

export function linkHref(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(www\.)?(facebook\.com|fb\.com|maps\.app\.goo\.gl|google\.com\/maps)/i.test(v)) {
    return `https://${v.replace(/^https?:\/\//i, '')}`;
  }
  return null;
}

export function storeSearchText(store: Store): string {
  return [
    store.name,
    store.store_code,
    store.arrp_id,
    store.first_name,
    store.last_name,
    store.city,
    store.barangay,
    store.address,
    store.phone,
    store.phone_alt,
    store.contact_person,
    store.email,
  ]
    .join(' ')
    .toLowerCase();
}

export function toStorePatch(form: StoreForm, profile: { id: string; full_name: string }) {
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const name = form.name.trim() || `${firstName} ${lastName}`.trim();
  const address = composeAddress(form) || form.street.trim();
  const age = form.age ? Number(form.age) : form.dob ? ageFromDob(form.dob) : null;
  return {
    name,
    first_name: firstName,
    last_name: lastName,
    classification: form.classification,
    pay_plan: form.payPlan,
    claimed_on: form.claimedOn || null,
    city: form.city.trim(),
    barangay: form.barangay.trim() || '—',
    address,
    house_no: form.houseNo.trim(),
    street: form.street.trim(),
    village: form.village.trim(),
    hoa: form.hoa.trim(),
    district: form.district.trim(),
    zip: form.zip.trim(),
    phone: form.phone.trim(),
    phone_alt: form.phoneAlt.trim(),
    contact_person: form.contactPerson.trim(),
    contact_phone: form.contactPhone.trim(),
    email: form.email.trim(),
    facebook: form.facebook.trim(),
    facebook_alt: form.facebookAlt.trim(),
    maps_url: form.mapsUrl.trim(),
    age: Number.isFinite(age) ? age : null,
    dob: form.dob || null,
    gender: (form.gender || null) as Store['gender'],
    channel: channelFor(form.classification),
    updated_by: profile.id,
    updated_by_name: profile.full_name || 'CENRO staff',
  };
}
