-- ============================================================================
-- VM Robotics Document Tracker — 0005 project spend tracking
-- Run after 0001–0004. Adds the Notion-style spend chain: people (assignees),
-- work_items (project tasks), orders (purchases). Spend rolls up from orders.
--
-- These are SEPARATE from the existing standalone `tasks` (reminders). RLS is
-- enabled inline (same migration that creates the tables) + authenticated-only
-- policies, matching 0001/0002.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- people — internal assignees (kept distinct from counterparties / suppliers).
-- ---------------------------------------------------------------------------

create table people (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text,
  email      text,
  active     boolean not null default true,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_people_updated_at
  before update on people
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- work_items — project tasks (Notion "Tasks"). stage/status are free text
-- because Notion's vocabulary differs from our document/case enums.
-- ---------------------------------------------------------------------------

create table work_items (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references cases(id) on delete cascade,
  name        text not null,
  stage       text,                       -- Design / Orders / Assembling / Instalation / Testing
  status      text,                       -- In progress / Waiting for materials / Blocked / In the bill / Done …
  cost        numeric(14, 2),
  assignee_id uuid references people(id) on delete set null,
  start_date  date,
  due_date    date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_work_items_updated_at
  before update on work_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- orders — purchases from suppliers. Spend = sum(orders.price) per case.
-- case_id is denormalized for fast per-project rollups; work_item_id optional.
-- ---------------------------------------------------------------------------

create table orders (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references cases(id) on delete cascade,
  work_item_id    uuid references work_items(id) on delete set null,
  supplier_id     uuid references counterparties(id) on delete set null,
  title           text not null,
  price           numeric(14, 2),
  currency        text default 'ILS',
  order_date      date,
  status          text,
  tracking_number text,                   -- mirrors documents.tracking_number (cross-link to customs docs)
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

comment on column orders.tracking_number is
  'Carrier tracking id; mirrors documents.tracking_number to tie a purchase to its carrier '
  'receipt / rashimon (brief §3 cross-linking key).';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_work_items_case_id     on work_items(case_id);
create index idx_work_items_assignee_id on work_items(assignee_id);
create index idx_work_items_due_date    on work_items(due_date);

create index idx_orders_case_id          on orders(case_id);
create index idx_orders_work_item_id     on orders(work_item_id);
create index idx_orders_supplier_id      on orders(supplier_id);
create index idx_orders_tracking_number  on orders(tracking_number);
create index idx_orders_order_date       on orders(order_date);

-- ---------------------------------------------------------------------------
-- RLS — enable + authenticated-only access (mirrors 0001/0002).
-- ---------------------------------------------------------------------------

alter table people     enable row level security;
alter table work_items enable row level security;
alter table orders     enable row level security;

create policy "authenticated full access" on people
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on work_items
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on orders
  for all to authenticated using (true) with check (true);
