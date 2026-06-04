-- ============================================================================
-- VM Robotics Document Tracker — 0001 schema
-- Run order: 0001 -> 0002 -> 0003 -> 0004 (paste each into the Supabase SQL editor).
--
-- Core entities (brief §3): case_types, counterparties, cases, documents,
-- payment_milestones, tasks. Clean table names — this is a dedicated database.
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto. (On Supabase this is usually already enabled.)
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums (controlled vocabularies). Only the document/case types named in the
-- brief §3/§4 — do not invent new ones here (brief §9); the catalogue is
-- extended in-app via case_types, not by adding enum values casually.
-- ---------------------------------------------------------------------------

create type case_group as enum (
  'import',
  'sale_service',
  'procurement',
  'project',
  'tax'
);

create type case_status as enum (
  'complete',
  'incomplete',
  'attention',
  'in_transit',
  'closed'
);

create type doc_type as enum (
  'commercial_invoice',
  'proforma_invoice',
  'packing_list',
  'rashimon',
  'carrier_receipt',
  'customs_voucher_184',
  'delivery_note',
  'tax_invoice',
  'receipt',
  'credit_note',
  'quote',
  'purchase_order',
  'vendor_onboarding',
  'tax_withholding_cert',
  'form_101'
);

create type extraction_status as enum (
  'pending',
  'extracted',
  'confirmed'
);

create type task_priority as enum ('high', 'med', 'low');

create type counterparty_kind as enum (
  'supplier',
  'carrier',
  'client',
  'authority'
);

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- case_types — catalogue of business-event types + their expected document
-- checklist. This is the "completeness" engine. Seeded in 0004, editable in-app.
-- ---------------------------------------------------------------------------

create table case_types (
  id                 uuid primary key default gen_random_uuid(),
  key                text not null unique,           -- e.g. 'import', 'project'
  "group"            case_group not null,
  name_he            text not null,
  name_en            text not null,
  -- JSON array of doc_type keys that make a case "complete".
  expected_documents jsonb not null default '[]'::jsonb,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column case_types.expected_documents is
  'jsonb array of doc_type keys; completeness compares a case''s documents against this list. '
  'For the import type, commercial_invoice may be satisfied by proforma_invoice — that '
  'substitution is handled by the app-side completeness logic in a later phase, not stored here.';

create trigger trg_case_types_updated_at
  before update on case_types
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- counterparties — suppliers, carriers, clients, authorities.
-- ---------------------------------------------------------------------------

create table counterparties (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       counterparty_kind not null,
  country    text,
  tax_id     text,
  email      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_counterparties_updated_at
  before update on counterparties
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- cases — one business event. The central entity. Supports hierarchy via
-- parent_id (e.g. a project parent with China-import child cases).
-- ---------------------------------------------------------------------------

create table cases (
  id            uuid primary key default gen_random_uuid(),
  case_type_id  uuid not null references case_types(id) on delete restrict,
  parent_id     uuid references cases(id) on delete set null,
  title         text not null,
  counterparty_id uuid references counterparties(id) on delete set null,
  -- Derived/cached completeness status. Phase 1 stores it; the derivation
  -- (compare documents' doc_types vs case_type.expected_documents, parent
  -- aggregates children) lands with Case CRUD / Dashboard.
  status        case_status not null default 'incomplete',
  currency      text,
  total_amount  numeric(14, 2),
  due_date      date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_cases_updated_at
  before update on cases
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- documents — a file attached to a case, plus AI-extracted fields.
-- Extracted fields are nullable, populated by AI, confirmed by a human (§5).
-- ---------------------------------------------------------------------------

create table documents (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references cases(id) on delete cascade,
  doc_type          doc_type not null,
  storage_path      text not null,                  -- Supabase Storage object path
  original_filename text,
  mime_type         text,
  uploaded_at       timestamptz not null default now(),
  -- Extracted fields (all nullable; blank rather than guessed when unreadable, §5)
  doc_number        text,
  tracking_number   text,                           -- cross-linking key (§3)
  rashimon_number   text,
  amount            numeric(14, 2),
  currency          text,
  doc_date          date,
  counterparty_name text,
  extraction_status extraction_status not null default 'pending',
  -- The model's full structured output, kept for audit.
  extraction_raw    jsonb
);

comment on column documents.tracking_number is
  'Carrier tracking id (e.g. DSV HD001118886, Gaash GH000362233, Post Y0034571736RN). '
  'Links a carrier receipt, a rashimon and a shipment; used to suggest auto-linking on upload (§3).';

-- ---------------------------------------------------------------------------
-- payment_milestones — staged payments within a case (e.g. 30/50/20).
-- ---------------------------------------------------------------------------

create table payment_milestones (
  id        uuid primary key default gen_random_uuid(),
  case_id   uuid not null references cases(id) on delete cascade,
  label     text not null,
  percent   numeric(5, 2),
  amount    numeric(14, 2),
  currency  text,
  due_date  date,
  paid      boolean not null default false,
  paid_at   timestamptz
);

-- ---------------------------------------------------------------------------
-- tasks — actionable items / reminders. case_id nullable (tasks can stand alone).
-- ---------------------------------------------------------------------------

create table tasks (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid references cases(id) on delete cascade,
  text       text not null,
  priority   task_priority not null default 'med',
  due_date   date,
  done       boolean not null default false,
  category   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_tasks_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes: foreign keys, the cross-linking keys, and the calendar date feeds.
-- ---------------------------------------------------------------------------

create index idx_cases_case_type_id      on cases(case_type_id);
create index idx_cases_parent_id         on cases(parent_id);
create index idx_cases_counterparty_id   on cases(counterparty_id);
create index idx_cases_due_date          on cases(due_date);

create index idx_documents_case_id         on documents(case_id);
create index idx_documents_tracking_number on documents(tracking_number);
create index idx_documents_rashimon_number on documents(rashimon_number);

create index idx_payment_milestones_case_id  on payment_milestones(case_id);
create index idx_payment_milestones_due_date on payment_milestones(due_date);

create index idx_tasks_case_id  on tasks(case_id);
create index idx_tasks_due_date on tasks(due_date);

-- ---------------------------------------------------------------------------
-- Enable Row Level Security on every table in the SAME migration that creates
-- them, so a table never exists unprotected (brief §2). With RLS enabled and no
-- policy yet, Postgres default-denies all access — anon and authenticated keys
-- get nothing until 0002 adds the policies. The service-role key (Vercel API
-- routes) bypasses RLS by design.
-- ---------------------------------------------------------------------------

alter table case_types         enable row level security;
alter table counterparties     enable row level security;
alter table cases              enable row level security;
alter table documents          enable row level security;
alter table payment_milestones enable row level security;
alter table tasks              enable row level security;
