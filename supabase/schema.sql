-- SEAblings hackathon schema.
-- Demo note: server-side API routes use the Supabase service-role key when configured.
-- Keep RLS simple for the demo and add policies only if the frontend later writes directly.

create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists personas (
  id text primary key,
  name text not null,
  color text not null,
  postal_code text not null,
  default_budget_max integer not null check (default_budget_max >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists ingestion_tasks (
  id text primary key default ('task-' || gen_random_uuid()::text),
  user_id text not null references personas(id) on delete cascade,
  status text not null check (status in ('queued', 'processing', 'extracting', 'enriching', 'embedding', 'completed', 'failed')),
  source_type text not null check (source_type in ('tiktok', 'instagram', 'screenshot', 'manual', 'text')),
  source_url text,
  text text,
  screenshot_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists ingestion_tasks_user_id_idx on ingestion_tasks (user_id);
create index if not exists ingestion_tasks_status_idx on ingestion_tasks (status, created_at desc);

create table if not exists bucket_items (
  id text primary key default ('item-' || gen_random_uuid()::text),
  user_id text not null references personas(id) on delete cascade,
  status text not null check (status in ('candidate', 'saved', 'completed', 'rejected', 'archived')),
  date_type text not null check (date_type in ('anytime', 'one_off', 'limited_run', 'scheduled')),
  title text not null,
  category text not null check (category in ('cafe', 'restaurant', 'nightlife', 'activity', 'culture', 'shopping')),
  description text not null,
  why_interesting text not null,
  location_name text not null,
  neighborhood text not null,
  address text,
  postal_code text,
  price_estimate text not null check (price_estimate in ('$', '$$', '$$$')),
  estimated_cost integer not null default 0 check (estimated_cost >= 0),
  opening_hours text,
  website_url text,
  photo_url text,
  photo_source_links jsonb not null default '[]'::jsonb,
  source_url text,
  source_type text not null check (source_type in ('tiktok', 'instagram', 'screenshot', 'manual', 'text')),
  enrichment_provider text,
  enrichment_status text check (enrichment_status in ('complete', 'partial', 'fallback')),
  enrichment_source_links jsonb not null default '[]'::jsonb,
  enrichment_confidence_note text,
  tags jsonb not null default '[]'::jsonb,
  confidence numeric(4, 3) not null default 0.7 check (confidence >= 0 and confidence <= 1),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists bucket_items_user_id_idx on bucket_items (user_id);
create index if not exists bucket_items_status_idx on bucket_items (status, updated_at desc);

alter table if exists bucket_items
  add column if not exists enrichment_provider text,
  add column if not exists enrichment_status text check (enrichment_status in ('complete', 'partial', 'fallback')),
  add column if not exists enrichment_source_links jsonb not null default '[]'::jsonb,
  add column if not exists enrichment_confidence_note text,
  add column if not exists photo_url text,
  add column if not exists photo_source_links jsonb not null default '[]'::jsonb;

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

create table if not exists messages (
  id text primary key,
  user_id text not null,
  text text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists messages_created_at_idx on messages (created_at desc);

create table if not exists zymix_messages (
  id text primary key default ('zymix-' || gen_random_uuid()::text),
  thread_id text not null,
  user_id text not null references personas(id) on delete cascade,
  text text not null check (char_length(btrim(text)) > 0 and char_length(text) <= 1000),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists zymix_messages_thread_created_at_idx on zymix_messages (thread_id, created_at asc);
create index if not exists zymix_messages_user_id_idx on zymix_messages (user_id, created_at desc);

create table if not exists planner_sessions (
  id text primary key,
  thread_id text not null,
  initiator_user_id text not null references personas(id) on delete cascade,
  status text not null check (status in ('collecting', 'voting', 'completed')),
  state jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists planner_sessions_thread_updated_at_idx on planner_sessions (thread_id, updated_at desc);

create table if not exists planner_criteria (
  user_id text primary key references personas(id) on delete cascade,
  budget_max integer not null check (budget_max >= 0),
  available_times jsonb not null default '[]'::jsonb,
  postal_code text not null,
  vetoes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists recommendations (
  bucket_item_id text primary key references bucket_items(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  reasons jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

-- Optional later:
-- alter table personas enable row level security;
-- alter table ingestion_tasks enable row level security;
-- alter table bucket_items enable row level security;
-- alter table messages enable row level security;
-- alter table zymix_messages enable row level security;
-- alter table planner_sessions enable row level security;
-- alter table planner_criteria enable row level security;
-- alter table recommendations enable row level security;
