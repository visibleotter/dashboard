-- ============================================================================
-- VM Robotics Document Tracker — 0003 Storage
--
-- Private bucket for uploaded source files (PDFs, phone photos). Not public: every
-- read/write requires an authenticated user. Client uploads go through the authed
-- Supabase client; Vercel API routes use the service-role key (which bypasses these
-- policies) to fetch files for AI extraction.
-- ============================================================================

-- Create the private 'documents' bucket (id == name). Idempotent re-run safe.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Policies on storage.objects scoped to this bucket, authenticated users only.

create policy "documents: authenticated read"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents');

create policy "documents: authenticated insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents');

create policy "documents: authenticated update"
  on storage.objects for update to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

create policy "documents: authenticated delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents');
