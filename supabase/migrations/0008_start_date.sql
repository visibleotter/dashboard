-- Add start_date to cases (used for project timelines and the Notion-style list view)
alter table cases add column if not exists start_date date;
