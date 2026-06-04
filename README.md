# VM Robotics — Document Tracking & Control System

Internal web app that bundles VM Robotics' business paperwork (supplier invoices, packing
lists, Israeli customs declarations / rashimon, carrier receipts, POs, quotes, tax invoices,
receipts, credit notes — in Hebrew/English/Chinese, PDFs and phone photos) into **Cases**,
tracks which documents are still missing against a per-type checklist, and surfaces what's
incomplete, due soon, and owed.

> **Source of truth:** [`CLAUDE.md`](CLAUDE.md) — read it before contributing. It pins the hard
> constraints (separate Supabase project, no Edge Functions, backend-only secrets, mandatory
> auth + RLS) and the phased build order.

## Stack

- **Vite + React + TypeScript**
- **Tailwind v4 + shadcn/ui** (logical RTL-aware utilities; Hebrew/RTL is the default)
- **Supabase** — Postgres database, file Storage, Auth
- **Vercel** — hosting + API routes (all server-side logic, incl. AI extraction)

## Status

**Checkpoint 1 of 8 complete:** project scaffold + database schema, RLS, storage, and seed.
Auth, Case CRUD, file upload, AI extraction, dashboard, calendar, and i18n are upcoming phases
(see [`CLAUDE.md`](CLAUDE.md) §8).

---

## Prerequisites (owner — done manually, once)

Claude Code writes the code and migrations but does **not** provision infrastructure or hold
secrets. Before the app can run against real data you must:

1. Create a **new, separate** Supabase project (do **not** reuse the vmrobotics.co.il site's
   project). Note its **Project URL**, **anon key**, and **service-role key**
   (Project Settings → API).
2. Create an **Anthropic API key** (needed only when the AI-extraction phase lands).
3. Provide these as environment variables (below).

## Environment variables

Copy `.env.example` to `.env` for local dev, and set the same in the Vercel project settings
for deployment.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client | Supabase anon key (auth + RLS-gated access) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Vercel API routes (bypasses RLS) |
| `ANTHROPIC_API_KEY` | **server only** | Vercel API route for AI extraction |

⚠️ The two **server-only** vars must never be prefixed with `VITE_` and never appear in client
code — only Vite `VITE_*` vars are exposed to the browser.

## Run the database migrations

No Supabase CLI required. In the Supabase dashboard → **SQL Editor**, paste and run each file
**in order**:

1. `supabase/migrations/0001_schema.sql` — enums, six tables, indexes, `updated_at` trigger, **RLS enabled** on every table
2. `supabase/migrations/0002_rls.sql` — authenticated-only access policies (anon denied)
3. `supabase/migrations/0003_storage.sql` — private `documents` storage bucket + policies
4. `supabase/migrations/0004_seed.sql` — seed the five `case_types` (groups + checklists)
5. `supabase/migrations/0005_projects_spend.sql` — project spend chain: `people`, `work_items`, `orders` (+ RLS)

Each file is idempotent where practical (`on conflict do nothing` for the bucket and seed), but
run them once, in order, on a fresh project.

**Quick verification (optional):** in the SQL editor, confirm six tables exist and the catalogue
seeded:

```sql
select key, "group", expected_documents from case_types order by key;  -- expect 5 rows
```

## Run the app locally

```bash
npm install
npm run dev
```

Open the printed URL. With no `.env` yet, the shell loads and shows **"Supabase לא מוגדר"**
(not configured); once the two `VITE_` vars are set it shows **"Supabase מחובר"** (connected).

```bash
npm run build     # type-check + production build
npm run preview   # preview the production build
```

## Deploy (Vercel)

Import the repo into Vercel, set all four env vars in Project Settings, and deploy. `vercel.json`
configures the Vite build, the SPA rewrite, and routes `api/*` to serverless functions.
