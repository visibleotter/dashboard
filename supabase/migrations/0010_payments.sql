-- ============================================================================
-- 0010 — Payments mirror (read-only sync from the owner's Google Sheet CashFlow_9)
-- ----------------------------------------------------------------------------
-- The sheet is the authoritative source. /api/sync-payments fetches the sheet
-- via a Google Service Account, derives a content hash per row, and upserts
-- here. Rows no longer present in the sheet are deleted. A row's case_id and
-- counterparty_id are filled IN-APP (not from the sheet) and survive resync
-- as long as the row's source content is unchanged.
-- ============================================================================

create table if not exists payments (
  id                uuid primary key default gen_random_uuid(),

  -- Identity from the source sheet
  sheet_row_hash    text not null unique,            -- sha1 of normalized row content
  sheet_row_num     integer,                         -- for debugging / ordering

  -- Mirrored columns
  date_opened       date,
  due_date          date,
  payment_received  date,
  invoice_number    text,
  direction         text not null check (direction in ('income','outcome')),
  price_before_vat  numeric(14,2),
  price_after_vat   numeric(14,2),
  remain            numeric(14,2),
  currency          text default 'ILS',
  status            text check (status in ('paid','not_paid')),
  info              text,
  client_raw        text,                            -- raw client string from sheet

  -- Linkage (filled in-app, preserved across resyncs while sheet_row_hash matches)
  counterparty_id   uuid references counterparties(id) on delete set null,
  case_id           uuid references cases(id) on delete set null,

  synced_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_payments_due_date   on payments(due_date);
create index if not exists idx_payments_direction  on payments(direction);
create index if not exists idx_payments_status     on payments(status);
create index if not exists idx_payments_synced_at  on payments(synced_at);
create index if not exists idx_payments_case_id    on payments(case_id);

create trigger trg_payments_updated_at
  before update on payments
  for each row execute function set_updated_at();

alter table payments enable row level security;

-- Same shape as the rest of the project: any authed user has full access; nothing public.
drop policy if exists "payments_select_authed" on payments;
create policy "payments_select_authed" on payments
  for select to authenticated using (true);

drop policy if exists "payments_modify_authed" on payments;
create policy "payments_modify_authed" on payments
  for all to authenticated using (true) with check (true);
