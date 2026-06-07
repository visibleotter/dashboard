-- ============================================================================
-- VM Robotics Document Tracker — 0006 service work-report + accounting module
-- Run after 0001–0005.
--
-- Adds: a 'work_report' document type for service cases, and a dedicated Accounting
-- area (payslips, withholding certs, expenses→Rivhit, monthly operating costs).
-- RLS enabled + authenticated-only policies, matching prior migrations.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Service Work Report doc type + service checklist
-- NB: ALTER TYPE ... ADD VALUE must run on its own (cannot be used in the same
-- statement batch that then uses the value). The SQL editor auto-commits each
-- statement, so running top-to-bottom is fine.
-- ---------------------------------------------------------------------------

alter type doc_type add value if not exists 'work_report';

update case_types
set expected_documents = '["quote","work_report","tax_invoice","receipt"]'::jsonb
where key = 'sale_service';

-- ---------------------------------------------------------------------------
-- 2. Employees flag on people
-- ---------------------------------------------------------------------------

alter table people add column if not exists is_employee boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3. Payslips (תלושי שכר) — monthly, per employee
-- ---------------------------------------------------------------------------

create table payslips (
  id                uuid primary key default gen_random_uuid(),
  person_id         uuid not null references people(id) on delete cascade,
  year              int not null,
  month             int not null check (month between 1 and 12),
  storage_path      text,
  original_filename text,
  mime_type         text,
  received          boolean not null default false,
  amount            numeric(14, 2),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (person_id, year, month)
);

create trigger trg_payslips_updated_at
  before update on payslips
  for each row execute function set_updated_at();

create index idx_payslips_period on payslips(year, month);

-- ---------------------------------------------------------------------------
-- 4. Tax certificates (אישור ניכוי מס / form 101)
-- ---------------------------------------------------------------------------

create table tax_certs (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null default 'withholding',  -- withholding | form_101
  year              int,
  valid_from        date,
  valid_to          date,
  rate              numeric(5, 2),
  storage_path      text,
  original_filename text,
  mime_type         text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_tax_certs_updated_at
  before update on tax_certs
  for each row execute function set_updated_at();

create index idx_tax_certs_valid_to on tax_certs(valid_to);

-- ---------------------------------------------------------------------------
-- 5. Expenses (company outcome → uploaded to Rivhit)
-- ---------------------------------------------------------------------------

create table expenses (
  id                 uuid primary key default gen_random_uuid(),
  supplier_id        uuid references counterparties(id) on delete set null,
  invoice_number     text,
  amount             numeric(14, 2),
  currency           text default 'ILS',
  expense_date       date,
  category           text,
  storage_path       text,
  original_filename  text,
  mime_type          text,
  rivhit_uploaded    boolean not null default false,
  rivhit_uploaded_at timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_expenses_updated_at
  before update on expenses
  for each row execute function set_updated_at();

create index idx_expenses_supplier_id     on expenses(supplier_id);
create index idx_expenses_expense_date     on expenses(expense_date);
create index idx_expenses_rivhit_uploaded  on expenses(rivhit_uploaded);

-- ---------------------------------------------------------------------------
-- 6. Monthly operating costs — categories + per-month entries
-- ---------------------------------------------------------------------------

create table op_cost_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort       int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table op_cost_entries (
  id          uuid primary key default gen_random_uuid(),
  year        int not null,
  month       int not null check (month between 1 and 12),
  category_id uuid not null references op_cost_categories(id) on delete cascade,
  amount      numeric(14, 2),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (year, month, category_id)
);

create trigger trg_op_cost_entries_updated_at
  before update on op_cost_entries
  for each row execute function set_updated_at();

create index idx_op_cost_entries_period on op_cost_entries(year, month);

-- seed the operating-cost categories (owner's list; editable later)
insert into op_cost_categories (name, sort) values
  ('Rent', 10),
  ('Arnona (City tax)', 20),
  ('Francisco Salary', 30),
  ('Vadim Salary', 40),
  ('Roberto Salary', 50),
  ('Vladimir Salary', 60),
  ('חשמל (Electricity)', 70),
  ('פיילס עוסק', 80),
  ('Pension / NI', 90)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 7. RLS — enable + authenticated-only access on all new tables
-- ---------------------------------------------------------------------------

alter table payslips           enable row level security;
alter table tax_certs          enable row level security;
alter table expenses           enable row level security;
alter table op_cost_categories enable row level security;
alter table op_cost_entries    enable row level security;

create policy "authenticated full access" on payslips
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on tax_certs
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on expenses
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on op_cost_categories
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on op_cost_entries
  for all to authenticated using (true) with check (true);
