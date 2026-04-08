alter table public.quiz_configs
add column if not exists workflow_json jsonb not null default '{}'::jsonb;