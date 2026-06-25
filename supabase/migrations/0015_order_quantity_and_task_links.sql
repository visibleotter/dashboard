-- ============================================================================
-- 0015 — Order quantity + many-to-many links to tasks
-- ----------------------------------------------------------------------------
-- Two intentional extensions:
--   1. orders.quantity — for ordering several units of the same item.
--      orders.price is now interpreted as UNIT price; line total = price × qty.
--   2. order_tasks — many-to-many link between orders and tasks. One purchase
--      order can supply several tasks (often across different projects), each
--      with its own quantity. The existing orders.case_id is kept as the
--      "primary" project for back-compat and for orders that aren't linked
--      to any task yet.
-- ============================================================================

alter table orders
  add column if not exists quantity numeric not null default 1;

create table if not exists order_tasks (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  task_id     uuid not null references tasks(id) on delete cascade,
  quantity    numeric not null default 1,
  created_at  timestamptz not null default now(),
  unique (order_id, task_id)
);

create index if not exists idx_order_tasks_order_id on order_tasks(order_id);
create index if not exists idx_order_tasks_task_id  on order_tasks(task_id);

alter table order_tasks enable row level security;

drop policy if exists "order_tasks_authed_all" on order_tasks;
create policy "order_tasks_authed_all" on order_tasks
  for all to authenticated using (true) with check (true);
