-- ============================================================================
-- 0013 — Per-project Task Kanban
-- ----------------------------------------------------------------------------
-- Adds a kanban_status enum + a sortable kanban_order to tasks. The legacy
-- `done` boolean stays — /tasks page keeps working — but the new TaskBoard
-- on each case page uses kanban_status as the column key. Done in either UI
-- keeps both in sync via a helper.
-- ============================================================================

alter table tasks
  add column if not exists kanban_status text not null default 'todo'
    check (kanban_status in ('todo','doing','blocked','done'));

-- Numeric so we can compute midpoint between neighbours on drag without
-- renumbering the whole column on every drop.
alter table tasks
  add column if not exists kanban_order numeric;

create index if not exists idx_tasks_kanban
  on tasks(case_id, kanban_status, kanban_order);

-- Backfill from `done` so existing data renders sensibly.
update tasks set kanban_status = 'done' where done = true and kanban_status = 'todo';
