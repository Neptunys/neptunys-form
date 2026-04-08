create extension if not exists pgcrypto;

create table if not exists public.quizzes (
  id text primary key,
  name text not null,
  slug text unique not null,
  status text not null default 'draft',
  layout_mode text not null default 'standalone',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_variants (
  id text primary key,
  quiz_id text not null references public.quizzes(id) on delete cascade,
  name text not null,
  traffic_weight integer not null default 50,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_sessions (
  id text primary key,
  quiz_id text not null references public.quizzes(id) on delete cascade,
  variant_id text not null references public.quiz_variants(id) on delete cascade,
  started_at timestamptz not null,
  completed_at timestamptz,
  landing_url text not null,
  referrer text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_term text not null default '',
  utm_content text not null default '',
  device_type text not null default 'mobile'
);

create table if not exists public.quiz_events (
  id text primary key,
  session_id text not null references public.quiz_sessions(id) on delete cascade,
  quiz_id text not null references public.quizzes(id) on delete cascade,
  variant_id text not null references public.quiz_variants(id) on delete cascade,
  event_name text not null,
  step_key text not null,
  question_id text,
  answer_value jsonb,
  occurred_at timestamptz not null,
  time_from_start_ms integer not null default 0,
  time_on_step_ms integer,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.leads (
  id text primary key,
  session_id text not null references public.quiz_sessions(id) on delete cascade,
  quiz_id text not null references public.quizzes(id) on delete cascade,
  variant_id text not null references public.quiz_variants(id) on delete cascade,
  result_key text not null,
  first_name text not null,
  phone text not null,
  contact_method text not null,
  best_time text not null,
  email text not null default '',
  consent boolean not null default false,
  answers_json jsonb not null default '{}'::jsonb,
  attribution_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references public.leads(id) on delete cascade,
  channel text not null,
  target text not null,
  status text not null default 'pending',
  provider_response jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.quizzes (id, name, slug, status, layout_mode)
values ('military-hearing-check', 'Military Hearing Check', 'military-hearing-check', 'published', 'standalone')
on conflict (id) do nothing;

insert into public.quiz_variants (id, quiz_id, name, traffic_weight, is_active)
values
  ('variant-a', 'military-hearing-check', 'Variant A', 70, true),
  ('variant-b', 'military-hearing-check', 'Variant B', 30, true)
on conflict (id) do nothing;

alter table public.quizzes enable row level security;
alter table public.quiz_variants enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_events enable row level security;
alter table public.leads enable row level security;
alter table public.notification_logs enable row level security;

drop policy if exists "public can read quizzes" on public.quizzes;
create policy "public can read quizzes"
on public.quizzes
for select
to anon, authenticated
using (true);

drop policy if exists "public can read quiz variants" on public.quiz_variants;
create policy "public can read quiz variants"
on public.quiz_variants
for select
to anon, authenticated
using (true);

drop policy if exists "anon can insert quiz sessions" on public.quiz_sessions;
create policy "anon can insert quiz sessions"
on public.quiz_sessions
for insert
to anon, authenticated
with check (true);

drop policy if exists "anon can insert quiz events" on public.quiz_events;
create policy "anon can insert quiz events"
on public.quiz_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "anon can insert leads" on public.leads;
create policy "anon can insert leads"
on public.leads
for insert
to anon, authenticated
with check (true);
