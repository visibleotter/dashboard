-- ============================================================================
-- VM Robotics Document Tracker — 0007 work_status
-- Run after 0001–0006.
--
-- Replaces the computed completeness `status` with a human-settable
-- work_status field: planned | in_progress | on_hold | robot_on_way | done.
-- Document completeness is now shown as a separate badge indicator in the UI;
-- it is suppressed for planned and on_hold cases.
-- ============================================================================

alter table cases
  add column if not exists work_status text not null default 'planned'
  check (work_status in ('planned', 'in_progress', 'on_hold', 'robot_on_way', 'done'));

-- Seed from the old computed status:
--   closed     → done
--   in_transit → robot_on_way
--   everything else → in_progress
update cases set work_status = 'done'         where status = 'closed';
update cases set work_status = 'robot_on_way' where status = 'in_transit';
update cases set work_status = 'in_progress'
  where status in ('complete', 'incomplete', 'attention');

create index if not exists idx_cases_work_status on cases(work_status);
