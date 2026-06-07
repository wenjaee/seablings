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

notify pgrst, 'reload schema';
