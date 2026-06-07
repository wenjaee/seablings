-- Persist planner bucket item photo enrichment.
-- Idempotent: safe to re-run on demo Supabase instances.

alter table if exists bucket_items
  add column if not exists photo_url text,
  add column if not exists photo_source_links jsonb not null default '[]'::jsonb;
