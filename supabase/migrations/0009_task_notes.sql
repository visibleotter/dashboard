-- Add a free-text notes field to tasks so a task card can carry context
-- (links, who to ask, decisions, etc.) without polluting the title.
alter table tasks add column if not exists notes text;
