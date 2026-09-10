'use client';

import { useState } from 'react';

import { barangayOptions, CITY_OPTIONS } from '@/lib/phPlaces';
import {
  CLASSIFICATION_OPTIONS,
  PAY_PLAN_OPTIONS,
  classificationLabel,
  linkHref,
  payPlanLabel,
  type StoreForm,
} from '@/lib/storeProfile';
import type { Store } from '@/lib/types';
import { tstamp } from '@/lib/format';
import { FilterMenu } from './FilterMenu';

export function StoreProfileForm({
  form,
  placeMenu,
  setPlaceMenu,
  onChange,
  showMoreDefault = false,
}: {
  form: StoreForm;
  placeMenu: string | null;
  setPlaceMenu: (id: string | null) => void;
  onChange: (patch: Partial<StoreForm>) => void;
  showMoreDefault?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(showMoreDefault);
  return (
    <div className="store-form">
      <p className="field-label">Classification</p>
      <div className="seg seg--wide">
        {CLASSIFICATION_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={form.classification === o.value ? 'is-on' : ''}
            onClick={() => onChange({ classification: o.value })}
          >
            {o.label}
          </button>
        ))}
      </div>

      <p className="field-label">Payment</p>
      <div className="seg seg--wide">
        {PAY_PLAN_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={form.payPlan === o.value ? 'is-on' : ''}
            onClick={() => onChange({ payPlan: o.value })}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="pricehint">
        {form.payPlan === 'fully_paid'
          ? 'Fully paid partners skip the ₱550 kit plan. Refill orders only.'
          : 'First kit is ₱550 × 9, starting the week after the claim date. After that they refill.'}
      </p>

      <label className="field">
        <span>Date claimed</span>
        <input
          className="input"
          type="date"
          value={form.claimedOn}
          onChange={(e) => onChange({ claimedOn: e.target.value })}
          required
        />
      </label>

      <div className="row2">
        <label className="field">
          <span>First name</span>
          <input
            className="input"
            value={form.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Last name</span>
          <input
            className="input"
            value={form.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            required
          />
        </label>
      </div>

      <label className="field">
        <span>Store / trade name</span>
        <input
          className="input"
          value={form.name}
          placeholder="Optional — defaults to first and last name"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>

      <label className="field">
        <span>Contact number</span>
        <input
          className="input"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          required
        />
      </label>

      <div className="place-row">
        <div className="field">
          <span>City</span>
          <FilterMenu
            id="store-city"
            openId={placeMenu}
            setOpenId={setPlaceMenu}
            label="City"
            value={form.city}
            options={CITY_OPTIONS}
            searchable
            placeholder="Select city"
            onChange={(city) => onChange({ city })}
          />
        </div>
        <div className="field">
          <span>Barangay</span>
          {barangayOptions(form.city).length ? (
            <FilterMenu
              id="store-barangay"
              openId={placeMenu}
              setOpenId={setPlaceMenu}
              label="Barangay"
              value={form.barangay}
              options={barangayOptions(form.city)}
              searchable
              placeholder="Select barangay"
              onChange={(barangay) => onChange({ barangay })}
            />
          ) : (
            <input
              className="input"
              value={form.barangay}
              placeholder="Barangay"
              onChange={(e) => onChange({ barangay: e.target.value })}
            />
          )}
        </div>
      </div>

      <details className="fold" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
        <summary>More details</summary>
        <div className="fold__body">
          <div className="row2">
            <label className="field">
              <span>Date of birth</span>
              <input
                className="input"
                type="date"
                value={form.dob}
                onChange={(e) => onChange({ dob: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Age</span>
              <input
                className="input"
                type="number"
                min={1}
                max={120}
                value={form.age}
                onChange={(e) => onChange({ age: e.target.value })}
              />
            </label>
          </div>
          <div className="field">
            <span>Gender</span>
            <div className="seg">
              <button type="button" className={form.gender === 'F' ? 'is-on' : ''} onClick={() => onChange({ gender: 'F' })}>
                Female
              </button>
              <button type="button" className={form.gender === 'M' ? 'is-on' : ''} onClick={() => onChange({ gender: 'M' })}>
                Male
              </button>
            </div>
          </div>

          <label className="field">
            <span>Other number</span>
            <input className="input" inputMode="tel" value={form.phoneAlt} onChange={(e) => onChange({ phoneAlt: e.target.value })} />
          </label>
          <div className="row2">
            <label className="field">
              <span>Other contact person</span>
              <input className="input" value={form.contactPerson} onChange={(e) => onChange({ contactPerson: e.target.value })} />
            </label>
            <label className="field">
              <span>Their number</span>
              <input className="input" inputMode="tel" value={form.contactPhone} onChange={(e) => onChange({ contactPhone: e.target.value })} />
            </label>
          </div>

          <div className="row2">
            <label className="field">
              <span>Building / house no.</span>
              <input className="input" value={form.houseNo} onChange={(e) => onChange({ houseNo: e.target.value })} />
            </label>
            <label className="field">
              <span>Street</span>
              <input className="input" value={form.street} onChange={(e) => onChange({ street: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span>Village / subdivision</span>
            <input className="input" value={form.village} onChange={(e) => onChange({ village: e.target.value })} />
          </label>
          <label className="field">
            <span>HOA</span>
            <input
              className="input"
              value={form.hoa}
              placeholder="Homeowners association, if any"
              onChange={(e) => onChange({ hoa: e.target.value })}
            />
          </label>
          <div className="row2">
            <label className="field">
              <span>District</span>
              <input className="input" value={form.district} onChange={(e) => onChange({ district: e.target.value })} />
            </label>
            <label className="field">
              <span>ZIP code</span>
              <input className="input" inputMode="numeric" value={form.zip} onChange={(e) => onChange({ zip: e.target.value })} />
            </label>
          </div>

          <label className="field">
            <span>Email</span>
            <input className="input" type="email" value={form.email} onChange={(e) => onChange({ email: e.target.value })} />
          </label>
          <label className="field">
            <span>Facebook name / URL</span>
            <input className="input" value={form.facebook} onChange={(e) => onChange({ facebook: e.target.value })} />
          </label>
          <label className="field">
            <span>Other contact Facebook</span>
            <input className="input" value={form.facebookAlt} onChange={(e) => onChange({ facebookAlt: e.target.value })} />
          </label>
          <label className="field">
            <span>Google Maps URL</span>
            <input className="input" value={form.mapsUrl} placeholder="https://maps.app.goo.gl/…" onChange={(e) => onChange({ mapsUrl: e.target.value })} />
          </label>
        </div>
      </details>
    </div>
  );
}

function Fact({ label, value, href }: { label: string; value?: string | null; href?: string | null }) {
  const text = (value || '').trim();
  if (!text) return null;
  return (
    <div className="facts__row">
      <dt>{label}</dt>
      <dd>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer">
            {text}
          </a>
        ) : (
          text
        )}
      </dd>
    </div>
  );
}

export function StoreProfileView({ store }: { store: Store }) {
  const address = [
    store.house_no,
    store.street,
    store.village,
    store.barangay && store.barangay !== '—' ? store.barangay : '',
    store.district,
    store.zip,
    store.city,
  ]
    .filter((v) => v && v !== '—')
    .join(', ');
  const person = `${store.first_name || ''} ${store.last_name || ''}`.trim();
  const gender = store.gender === 'F' ? 'Female' : store.gender === 'M' ? 'Male' : '';
  const maps = linkHref(store.maps_url || '');
  const fb = linkHref(store.facebook || '');
  const fbAlt = linkHref(store.facebook_alt || '');
  const phones = [store.phone, store.phone_alt].filter(Boolean).join(' · ');

  return (
    <div className="profile-facts">
      <div className="ids">
        {store.arrp_id ? <span className="idpill idpill--arrp">{store.arrp_id}</span> : null}
      </div>
      <p className="profile-facts__tags">
        {[classificationLabel(store.classification), payPlanLabel(store.pay_plan)].join(' · ')}
      </p>
      {person && person !== store.name ? <p>{person}</p> : null}
      {phones ? <p>{phones}</p> : null}
      {address ? <p className="s">{address}</p> : null}

      <details className="fold">
        <summary>Full profile</summary>
        <dl className="facts">
          <Fact label="First name" value={store.first_name} />
          <Fact label="Last name" value={store.last_name} />
          <Fact label="Age" value={store.age ? String(store.age) : ''} />
          <Fact label="Date of birth" value={store.dob} />
          <Fact label="Gender" value={gender} />
          <Fact label="Contact" value={store.phone} />
          <Fact label="Other number" value={store.phone_alt} />
          <Fact
            label="Other contact"
            value={
              store.contact_person || store.contact_phone
                ? [store.contact_person, store.contact_phone].filter(Boolean).join(' · ')
                : ''
            }
          />
          <Fact label="House / bldg" value={store.house_no} />
          <Fact label="Street" value={store.street} />
          <Fact label="Village" value={store.village} />
          <Fact label="Barangay" value={store.barangay !== '—' ? store.barangay : ''} />
          <Fact label="HOA" value={store.hoa} />
          <Fact label="District" value={store.district} />
          <Fact label="ZIP" value={store.zip} />
          <Fact label="City" value={store.city} />
          <Fact label="Email" value={store.email} />
          <Fact label="Facebook" value={store.facebook} href={fb} />
          <Fact label="Other Facebook" value={store.facebook_alt} href={fbAlt} />
          <Fact label="Google Maps" value={maps ? 'Open map' : store.maps_url} href={maps || undefined} />
        </dl>
      </details>

      <p className="audit">
        {store.updated_at
          ? `Updated ${tstamp(store.updated_at)}${store.updated_by_name ? ` · ${store.updated_by_name}` : ''}`
          : `Opened ${tstamp(store.created_at)}`}
      </p>
    </div>
  );
}

export function StoreIdsBar({ store }: { store: Store }) {
  if (!store.arrp_id) return null;
  return (
    <div className="ids ids--head">
      {store.arrp_id ? <span className="idpill idpill--arrp">{store.arrp_id}</span> : null}
    </div>
  );
}
