-- Zymix chat persistence + realtime for the live Supabase instance.
-- Idempotent: safe to re-run. Run in the Supabase Dashboard SQL editor.

create extension if not exists pgcrypto;

create table if not exists zymix_messages (
  id text primary key default ('zymix-' || gen_random_uuid()::text),
  thread_id text not null,
  user_id text not null references personas(id) on delete cascade,
  text text not null check (char_length(btrim(text)) > 0 and char_length(text) <= 1000),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists zymix_messages_thread_created_at_idx on zymix_messages (thread_id, created_at asc);
create index if not exists zymix_messages_user_id_idx on zymix_messages (user_id, created_at desc);

-- Realtime: add the table to the supabase_realtime publication (guarded for idempotency).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'zymix_messages'
  ) then
    alter publication supabase_realtime add table zymix_messages;
  end if;
end $$;

-- RLS: the server uses the secret (service) key and bypasses RLS for reads/writes.
-- This permissive SELECT policy exists only so the anon realtime client receives inserts.
-- DEMO-level: anyone with the public anon key can read all messages. Not for production.
alter table zymix_messages enable row level security;
drop policy if exists "zymix_messages_anon_read" on zymix_messages;
create policy "zymix_messages_anon_read"
  on zymix_messages
  for select
  to anon, authenticated
  using (true);
grant select on zymix_messages to anon, authenticated;
