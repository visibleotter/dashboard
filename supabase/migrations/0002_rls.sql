-- ============================================================================
-- VM Robotics Document Tracker — 0002 RLS policies
--
-- RLS is ENABLED in 0001 (in the same migration the tables are created), so the
-- tables are never exposed unprotected. With RLS on and no policy, Postgres
-- default-denies everything. This file adds the access policies.
--
-- Single-user now, model-ready for expansion (brief §9): policies grant full CRUD
-- to any AUTHENTICATED user. There is intentionally no owner_id / per-user scoping
-- yet — when staff/accountant roles are added later, these policies are the seam to
-- tighten (add an owner_id column + restrict the USING/WITH CHECK clauses).
--
-- The Vercel API routes use the service-role key, which bypasses RLS by design; that
-- is the only path that should ever run without an authenticated user. Anonymous
-- access gets nothing, on every table.
--
-- (RLS is re-asserted below as a no-op safety net in case 0002 is run standalone.)
-- ============================================================================

alter table case_types         enable row level security;
alter table counterparties     enable row level security;
alter table cases              enable row level security;
alter table documents          enable row level security;
alter table payment_milestones enable row level security;
alter table tasks              enable row level security;

-- One permissive policy per table: authenticated users only, all commands.
-- drop-if-exists first so this file is safe to re-run.

drop policy if exists "authenticated full access" on case_types;
create policy "authenticated full access" on case_types
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on counterparties;
create policy "authenticated full access" on counterparties
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on cases;
create policy "authenticated full access" on cases
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on documents;
create policy "authenticated full access" on documents
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on payment_milestones;
create policy "authenticated full access" on payment_milestones
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on tasks;
create policy "authenticated full access" on tasks
  for all to authenticated using (true) with check (true);
