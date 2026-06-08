-- ============================================================================
-- 0011 — Polymorphic attachments for tasks and orders
-- ----------------------------------------------------------------------------
-- Cases already get rich, AI-extracted `documents`. Tasks and orders just want
-- a quick paper-trail (a phone photo, a PDF, a signed work-report). One row =
-- one file. Storage reuses the existing private `documents` bucket under the
-- `attachments/<entity_type>/<entity_id>/<uuid>.<ext>` prefix; no new bucket.
-- ============================================================================

create table if not exists attachments (
  id                uuid primary key default gen_random_uuid(),
  entity_type       text not null check (entity_type in ('task','order')),
  entity_id         uuid not null,
  storage_path      text not null unique,
  original_filename text,
  mime_type         text,
  size_bytes        bigint,
  uploaded_at       timestamptz not null default now(),
  uploaded_by       uuid references auth.users(id) on delete set null
);

create index if not exists idx_attachments_entity      on attachments(entity_type, entity_id);
create index if not exists idx_attachments_uploaded_at on attachments(uploaded_at desc);

alter table attachments enable row level security;

drop policy if exists "attachments_authed_all" on attachments;
create policy "attachments_authed_all" on attachments
  for all to authenticated using (true) with check (true);
