-- Align existing Supabase instances with the SEAblings place enrichment contract.
-- Run manually before using the live provider-backed capture pipeline.
-- NOTE: pre-existing CHECK constraints are dropped BEFORE the data is normalized,
-- so legacy values (e.g. category 'eats' -> 'restaurant') don't trip the old checks.
-- Idempotent: safe to re-run (the drop loop also removes the new constraints first).

create extension if not exists vector;

alter table if exists bucket_items
  add column if not exists enrichment_provider text,
  add column if not exists enrichment_status text,
  add column if not exists enrichment_source_links jsonb not null default '[]'::jsonb,
  add column if not exists enrichment_confidence_note text;

-- Drop any existing category / price_estimate / enrichment_status CHECK constraints first
-- (matched by definition, so name-agnostic) so the normalization UPDATEs below can run.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'bucket_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table bucket_items drop constraint if exists %I', constraint_name);
  end loop;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'bucket_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%price_estimate%'
  loop
    execute format('alter table bucket_items drop constraint if exists %I', constraint_name);
  end loop;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'bucket_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%enrichment_status%'
  loop
    execute format('alter table bucket_items drop constraint if exists %I', constraint_name);
  end loop;
end $$;

-- Normalize legacy categories to the PRD set, then coerce any stragglers to 'other'.
update bucket_items
set category = case category
  when 'eats' then 'restaurant'
  when 'drinks' then 'bar'
  when 'hidden_gem' then 'other'
  when 'market' then 'shopping'
  else category
end
where category in ('eats', 'drinks', 'hidden_gem', 'market');

update bucket_items
set category = 'other'
where category not in ('bakery', 'cafe', 'restaurant', 'bar', 'nightlife', 'activity', 'culture', 'shopping', 'other');

-- Normalize price_estimate to the $ / $$ / $$$ tiers.
update bucket_items
set price_estimate = case
  when price_estimate in ('$', '$$', '$$$') then price_estimate
  when price_estimate ~* '(free|gratis|no cost|cheap|budget|affordable|low[- ]cost)' then '$'
  when price_estimate in ('£', '€') then '$'
  when price_estimate in ('££', '€€') then '$$'
  when price_estimate in ('£££', '€€€') then '$$$'
  when price_estimate ~* '(luxury|expensive|upscale|premium|fine dining)' then '$$$'
  else '$$'
end
where price_estimate is distinct from case
  when price_estimate in ('$', '$$', '$$$') then price_estimate
  when price_estimate ~* '(free|gratis|no cost|cheap|budget|affordable|low[- ]cost)' then '$'
  when price_estimate in ('£', '€') then '$'
  when price_estimate in ('££', '€€') then '$$'
  when price_estimate in ('£££', '€€€') then '$$$'
  when price_estimate ~* '(luxury|expensive|upscale|premium|fine dining)' then '$$$'
  else '$$'
end;

-- Strip system/source tags from the tags array.
update bucket_items
set tags = coalesce(
  (
    select jsonb_agg(tag)
    from jsonb_array_elements_text(bucket_items.tags) as source(tag)
    where tag not in (
      'tiktok',
      'instagram',
      'screenshot',
      'manual',
      'text',
      'ai-ingested',
      'gemini-extracted',
      'perplexity-enriched',
      'provider-enriched'
    )
  ),
  '[]'::jsonb
)
where tags ?| array[
  'tiktok',
  'instagram',
  'screenshot',
  'manual',
  'text',
  'ai-ingested',
  'gemini-extracted',
  'perplexity-enriched',
  'provider-enriched'
];

-- Add the PRD CHECK constraints now that the data conforms.
alter table bucket_items
  add constraint bucket_items_category_prd_check
    check (category in ('bakery', 'cafe', 'restaurant', 'bar', 'nightlife', 'activity', 'culture', 'shopping', 'other')),
  add constraint bucket_items_price_estimate_tier_check
    check (price_estimate in ('$', '$$', '$$$')),
  add constraint bucket_items_enrichment_status_check
    check (enrichment_status is null or enrichment_status in ('complete', 'partial', 'fallback'));

create table if not exists bucket_item_embeddings (
  bucket_item_id text primary key references bucket_items(id) on delete cascade,
  embedding vector(768) not null,
  embedding_text text not null,
  model text not null,
  dimensions integer not null default 768 check (dimensions = 768),
  content_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists bucket_item_embeddings_content_hash_idx on bucket_item_embeddings (content_hash);
