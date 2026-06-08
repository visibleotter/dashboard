-- ============================================================================
-- 0012 — Attachments can also be a link (Google Drive, etc.), not just an upload
-- ----------------------------------------------------------------------------
-- Same `attachments` table; one row is now either a file (storage_path set) OR
-- an external link (external_url set), never both. `original_filename` doubles
-- as the human label for links.
-- ============================================================================

alter table attachments
  alter column storage_path drop not null;

-- The original `unique` constraint becomes a partial unique index so multiple
-- link rows (no storage_path) don't collide.
alter table attachments
  drop constraint if exists attachments_storage_path_key;

create unique index if not exists attachments_storage_path_unique
  on attachments(storage_path)
  where storage_path is not null;

alter table attachments
  add column if not exists external_url text;

-- Exactly one target: file XOR link
alter table attachments
  drop constraint if exists attachments_one_target_chk;
alter table attachments
  add constraint attachments_one_target_chk
  check ((storage_path is null) <> (external_url is null));
