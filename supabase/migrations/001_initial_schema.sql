-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Job applications table
create table public.jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  company        text not null,
  title          text not null,
  description    text,
  salary_min     integer,
  salary_max     integer,
  salary_currency text not null default 'USD',
  location       text,
  url            text,
  status         text not null default 'saved'
                   check (status in ('saved','applied','interview','offer','rejected','ghosted','withdrawn')),
  notes          text,
  applied_at     timestamptz,
  last_contact_at timestamptz,
  follow_up_sent_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Timeline events per job
create table public.job_events (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null
                  check (type in ('status_change','email_received','note_added','manual_update')),
  from_status   text,
  to_status     text,
  description   text,
  email_subject text,
  email_snippet text,
  created_at    timestamptz not null default now()
);

-- Auto-update updated_at on jobs
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_updated_at
  before update on public.jobs
  for each row execute function public.handle_updated_at();

-- Row-level security: users can only see their own data
alter table public.jobs enable row level security;
alter table public.job_events enable row level security;

create policy "users manage own jobs"
  on public.jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage own events"
  on public.job_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes for common queries
create index jobs_user_status on public.jobs(user_id, status);
create index jobs_last_contact on public.jobs(user_id, last_contact_at);
create index job_events_job_id on public.job_events(job_id, created_at desc);
