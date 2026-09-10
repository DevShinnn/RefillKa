# RefillKa — Collection Logging System

A live, role-based collection-logging platform for RefillKa, built for **nationwide**
rollout and starting with the **Taguig Monitored Field Study** (pre-pilot).

Stack: **Next.js 15 (App Router) + TypeScript**, **Supabase** (Auth + Postgres + Realtime),
deployable to **Vercel**.

## Tenancy model

Data is organized as a hierarchy and every row is scoped to it:

```
Region  →  LGU (city / municipality)  →  Store  →  Collection
```

Row-Level Security restricts each user to the data inside **their own scope**, so a Taguig
officer never sees another city's data, while regional and national roles roll up.

**Stores are the source of the data, not login accounts.** The people who log in the portal are
**CENRO staff** (and admins). CENRO select which store a collection came from when logging.

| Role | Scope | Lands on | Can do |
| --- | --- | --- | --- |
| **superadmin** | everything | `/admin` | Developer / platform owner — full control, incl. managing national admins |
| **cenro** | one LGU | `/log` | Log field collections from any store in their LGU |
| **lgu_admin** | one LGU | `/admin` | Manage stores/users + review, correct, export data for their LGU |
| **lgu_exec** | one LGU | `/executive` | Read-only dashboard for their LGU (e.g. City Mayor) |
| **regional_exec** | one region | `/executive` | Read-only dashboard for their region |
| **national_admin** | all | `/admin` | Admin across every LGU (HQ / DENR) |
| **national_exec** | all | `/executive` | Read-only national dashboard (CEO / Owner) |

All views subscribe to the `collections` table over **Supabase Realtime**, so data updates
across devices instantly.

## Security

- **Supabase Auth** (email/password), cookie sessions via `@supabase/ssr`.
- **Row-Level Security** on every table (`supabase/migrations/0001_init.sql`):
  - reads/writes scoped by region/LGU/store; role + scope resolved by `security definer`
    helpers to avoid RLS recursion.
  - collections carry denormalized `lgu_id`/`region_id` so scoped reads stay fast at national volume.
  - stores insert only for their own store; executives are read-only; only admins update/delete
    within their scope.
  - triggers block self role/scope escalation and stamp `logged_by` server-side (can't be spoofed).
- **Middleware** (`middleware.ts`) refreshes the session and enforces per-route role access;
  each page re-checks server-side (`lib/auth.ts`) as defense in depth.

> This is the pilot foundation. Before national go-live, also add: audit trail + soft-delete,
> MFA for admin/executive roles, server-side aggregation for dashboards, and Data Privacy Act
> (RA 10173) alignment. See the team for the hardening plan.

## Setup

### 1. Create a Supabase project
[supabase.com/dashboard](https://supabase.com/dashboard) → **New project**. Copy the project
URL and keys (Project Settings → **API**).

### 2. Apply the schema
In the Supabase **SQL Editor**, run in order:
1. `supabase/migrations/0001_init.sql` — tables, RLS, triggers, realtime
2. `supabase/seed_reference.sql` — 17 regions, sample LGUs, and the Taguig pilot stores

### 3. Configure env
```bash
cp .env.local.example .env.local
```
Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (for seeding only)
`SUPABASE_SERVICE_ROLE_KEY`.

### 4. Install & create test accounts
```bash
npm install
npm run seed:users
```

### 5. Run
```bash
npm run dev            # http://localhost:3000
```

## Pre-pilot test accounts
All use password **`RefillKa2030!`** (change before any real pilot — edit `scripts/seed-users.mjs`).

| Role | Email | Scope |
| --- | --- | --- |
| CENRO | `cenro.santos@refillka.test` | Taguig |
| LGU Admin | `taguig.admin@refillka.test` | Taguig |
| LGU Exec (Mayor) | `mayor.taguig@refillka.test` | Taguig |
| Regional Exec | `ncr.director@refillka.test` | NCR |
| National Admin | `admin@refillka.test` | National |
| National Exec (CEO) | `ceo@refillka.test` | National |
| Superadmin (Developer) | `dev@refillka.test` | Everything |

> `@refillka.test` is a placeholder domain; the seed sets `email_confirm: true` so these work
> without a real inbox. For a real pilot, use real emails and keep confirmation on.

## Deploy to Vercel
1. Push this repo to GitHub.
2. Import it in Vercel → framework auto-detected as **Next.js**.
3. Add env vars **`NEXT_PUBLIC_SUPABASE_URL`** and **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   (do **not** add the service-role key to Vercel).
4. In Supabase → Authentication → **URL Configuration**, add your Vercel domain.
5. Deploy.

## Data model
- **regions / lgus** — the Philippine administrative hierarchy (reference data).
- **stores** — the source refill points, each under an LGU (reference data, not accounts).
- **profiles** — one per auth user; holds `role` + scope (`region_id` / `lgu_id`).
- **collections** — the ledger, scoped to store/LGU/region, with material, quantity, unit, notes, timestamps.

Materials + the "sachet-equivalent" weighting live in `lib/types.ts`.
