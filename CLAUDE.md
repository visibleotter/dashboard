# CLAUDE.md — VM Robotics Document Tracking & Control System

This file is the project's source of truth for Claude Code and any contributor. Read it fully
before writing code. It is the build brief, condensed, with the hard constraints pinned at the
top so future sessions do not violate them.

---

## ⛔ Hard constraints — do NOT violate (brief §2)

1. **Separate Supabase project.** This system uses its own NEW Supabase project. Never reuse,
   reference, or touch the `vmrobotics.co.il` marketing site's Supabase project. Data, keys,
   and auth are fully isolated.
2. **No Supabase Edge Functions.** They returned 401 on this team's stack. ALL server-side
   logic (including AI extraction) runs through **Vercel API routes** in `api/`.
3. **Anthropic key is backend-only.** `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` live
   only in Vercel env / `api/` routes. NEVER ship them to the browser, never prefix with
   `VITE_`, never call Anthropic from client code.
4. **Auth + RLS are mandatory.** Every table has RLS enabled; no anonymous access to business
   data. A separate project is not an open project.
5. **Owner provisions secrets.** Claude Code writes schema/migrations/code and documents the
   required env vars, but does NOT create the Supabase project, create the Anthropic key, or
   enter secrets into Vercel. The owner does those manually.
6. **Extraction proposes, the human confirms.** Never write extracted data to `confirmed`
   state silently. Always show what was read with editable fields before saving (§5).
7. **No invented types.** Do not add document types or case types beyond those in the brief;
   the owner adjusts the catalogue in-app.
8. **Build in phases.** Respect the checkpoints in §8 below — do not build everything at once.

## Stack

Vite + React + **TypeScript** · Tailwind v4 + **shadcn/ui** (logical RTL-aware utilities) ·
Supabase (Postgres DB, Storage, Auth) · Vercel (hosting + API routes).

## Required env vars

| Var | Scope | Used by |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client | browser Supabase client |
| `VITE_SUPABASE_ANON_KEY` | client | browser Supabase client (auth + RLS-gated access) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Vercel API routes (bypasses RLS) |
| `ANTHROPIC_API_KEY` | **server only** | Vercel API route for AI extraction |

See `.env.example`. The two `VITE_` vars are the only ones the browser ever sees.

---

## Data model (brief §3)

Six tables in `supabase/migrations/0001_schema.sql`:

- **case_types** — catalogue of business-event types + their `expected_documents` checklist
  (the completeness engine). Seeded in `0004`, editable in-app later.
- **counterparties** — suppliers, carriers, clients, authorities.
- **cases** — the central entity; one business event. Self-referencing `parent_id` enables
  hierarchy (a project parent with import child cases). `status` is a cached completeness flag.
- **documents** — a file attached to a case + AI-extracted fields (all nullable, human
  confirmed). `extraction_raw` keeps the model's full output for audit.
- **payment_milestones** — staged payments within a case (e.g. 30/50/20).
- **tasks** — actionable items / reminders; `case_id` nullable (can stand alone).

**Completeness logic:** a case's status compares its documents' `doc_type`s against its
`case_type.expected_documents`; missing types → incomplete, and the UI lists exactly which are
absent. A parent case aggregates its own documents plus its children's completeness.

**Cross-linking key:** `documents.tracking_number` links a carrier receipt, a rashimon, and a
shipment; used to suggest auto-linking documents to the same case on upload.

## Meaningful groups & starter checklists (brief §4)

Seeded in `0004_seed.sql`:

- **Import** (ייבוא) — commercial_invoice (or proforma), packing_list, rashimon,
  carrier_receipt, customs_voucher_184
- **Sales & Service** (מכירות ושירות) — delivery_note, tax_invoice, receipt (+ optional credit_note)
- **Procurement** (רכש מקומי) — tax_invoice, receipt
- **Projects** (פרויקטים) — quote, purchase_order, staged tax_invoices, delivery_note, receipt
  (may require vendor_onboarding); usually a parent with import children
- **Tax & Regulatory** (מסים ורגולציה) — tax_withholding_cert, form_101

## AI extraction (brief §5) — not yet built

Flow: upload 1–10 files → store in Supabase Storage → a **Vercel API route** sends each to the
Anthropic API for structured extraction → save as a draft `document` (`extraction_status =
'extracted'`, raw JSON in `extraction_raw`) → propose a case to attach to (match on
tracking_number / counterparty / numbers) or create a new one → **human reviews & confirms every
extraction** before commit (`confirmed`). Prefer sending the document image/PDF to the model
over relying on garbled RTL text extraction; handle HE/EN/ZH and angled phone photos; leave a
field blank rather than guess when unsure. Batch UX = a review queue with per-draft confirm/edit/
assign and a "confirm all" only after review.

## Screens (brief §6) — not yet built

Dashboard · Case detail (the heart: documents, gap checklist, milestones, child cases, timeline)
· Upload & confirm · Calendar · Upcoming-tasks widget · Knowledge base (renders the process
handbook).

## Bilingual EN + HE (brief §7) — not yet built

Full i18n from the start: `he.json` + `en.json`. **Hebrew is default and RTL** — toggle the whole
layout `dir`, not just strings. Document data (names, descriptions) shows as-is in its original
language regardless of UI language.

---

## Build order — phased, with checkpoints (brief §8)

Stop at each checkpoint to show progress before continuing.

1. **✅ Database schema + migrations + RLS + seed.**
2. **✅ Auth — login gating all data.** (login-only; users created in the Supabase dashboard;
   `src/lib/auth.tsx` provider + `src/components/Login.tsx`; `App.tsx` gates all data.)
3. **✅ Case CRUD — manual create, list (grouped)/edit/delete, hierarchy via `parent_id`.**
   (react-router; `src/lib/data.ts` typed queries; `src/lib/labels.ts`; `CasesListPage` +
   `CaseFormPage` + `CounterpartySelect`. Draft-from-upload comes with Phase 4/5.)
4. **✅ File upload + Storage — attach files to cases.** (`DocumentsSection` on the case edit
   page; `uploadDocument`/`getDocumentUrl`/`deleteDocument` in `data.ts`; private `documents`
   bucket, files at `<caseId>/<uuid>.<ext>`, signed URLs for viewing, manual `doc_type`.)
5. 🟡 Document fields — **manual entry done** (editable per-document fields in
   `DocumentsSection`: doc/tracking/rashimon numbers, amount, currency, date, counterparty;
   saving marks the row `confirmed`). ⬜ **AI extraction deferred:** a Vercel API route will
   later pre-fill these same fields from the file (Anthropic), then the human confirms via the
   same form. Needs `ANTHROPIC_API_KEY` when built.
6. **✅ Dashboard — groups, summary stats, completeness/gap display.** (`src/lib/completeness.ts`
   pure engine: doc_types vs `expected_documents`, commercial/proforma substitution, effective
   status, parent aggregates children; `listCasesWithDocs`; `DashboardPage` at `/`, cases list
   moved to `/cases`; both derive status live so they agree.)
7. **✅ Timeline + Calendar + upcoming-tasks widget.** (`src/lib/dates.ts` urgency buckets;
   `MilestonesSection` + `CaseTimeline` on the case page; `TasksPage` (/tasks) + `UpcomingTasks`
   dashboard widget; `CalendarPage` (/calendar) merges cases/milestones/tasks due dates via
   `listCalendarItems`, grouped by urgency.)
8. **✅ Bilingual EN/HE + knowledge-base page.** (`src/lib/i18n.tsx` provider with `t()`/`tl()`,
   `he.json`/`en.json` (key parity), `LanguageToggle` flips the whole `dir`; `dates.ts`
   localized; all components refactored off inline strings; `src/lib/knowledgeBase.ts` holds the
   5 processes translated HE+EN from the handbook, rendered by `KnowledgeBasePage` at `/kb`.)

## Project layout

```
api/                      Vercel serverless routes (server-only secrets). See api/README.md.
supabase/migrations/      0001 schema · 0002 RLS · 0003 storage · 0004 seed (run in order).
src/
  lib/supabaseClient.ts   Browser client (anon key only).
  lib/utils.ts            cn() classname helper.
  types/db.ts             Hand-written TS types mirroring the schema.
  App.tsx, main.tsx       Minimal scaffold shell (replaced as screens are built).
```

## Migrations

Owner-provisioned project, no CLI required: paste `0001` → `0004` into the Supabase SQL editor
in order. See `README.md` for the step-by-step.
