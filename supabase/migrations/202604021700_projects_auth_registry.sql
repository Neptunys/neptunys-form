create table if not exists public.projects (
	id text primary key,
	name text not null,
	slug text not null unique,
	notes text not null default '',
	active_quiz_id text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.quizzes
add column if not exists project_id text references public.projects(id) on delete cascade;

create table if not exists public.project_members (
	project_id text not null references public.projects(id) on delete cascade,
	user_id uuid not null references auth.users(id) on delete cascade,
	role text not null default 'admin',
	created_at timestamptz not null default now(),
	primary key (project_id, user_id)
);

create table if not exists public.quiz_configs (
	quiz_id text primary key references public.quizzes(id) on delete cascade,
	theme_json jsonb not null default '{}'::jsonb,
	lead_steps_json jsonb not null default '[]'::jsonb,
	transition_screen_json jsonb not null default '{}'::jsonb,
	thank_you_screen_json jsonb not null default '{}'::jsonb,
	result_content_json jsonb not null default '{}'::jsonb,
	variants_json jsonb not null default '[]'::jsonb,
	updated_at timestamptz not null default now()
);

create table if not exists public.quiz_domains (
	id uuid primary key default gen_random_uuid(),
	quiz_id text not null references public.quizzes(id) on delete cascade,
	hostname text not null unique,
	is_primary boolean not null default true,
	created_at timestamptz not null default now()
);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
	select coalesce(auth.jwt() ->> 'email', '') = 'contact@neptunys.com';
$$;

create or replace function public.is_project_member(target_project_id text)
returns boolean
language sql
stable
as $$
	select
		public.is_platform_admin()
		or exists (
			select 1
			from public.project_members project_member
			where project_member.project_id = target_project_id
				and project_member.user_id = auth.uid()
		);
$$;

insert into public.projects (id, name, slug, notes, active_quiz_id)
values
	(
		'project-military-claims',
		'Military Claims',
		'military-claims',
		'Primary cold-traffic project for hearing-loss qualification.',
		'military-hearing-check'
	),
	(
		'project-neptunys-audit',
		'Neptunys Audit Demo',
		'neptunys-audit',
		'Operator-centre demo project for previewing the multi-project flow.',
		'military-hearing-check-demo'
	)
on conflict (id) do update
set
	name = excluded.name,
	slug = excluded.slug,
	notes = excluded.notes,
	active_quiz_id = excluded.active_quiz_id,
	updated_at = now();

insert into public.quizzes (id, project_id, name, slug, status, layout_mode)
values
	(
		'military-hearing-check',
		'project-military-claims',
		'Military Hearing Check',
		'military-hearing-check',
		'published',
		'standalone'
	),
	(
		'military-hearing-check-demo',
		'project-neptunys-audit',
		'Veteran Hearing Review',
		'veteran-hearing-review',
		'draft',
		'standalone'
	)
on conflict (id) do update
set
	project_id = excluded.project_id,
	name = excluded.name,
	slug = excluded.slug,
	status = excluded.status,
	layout_mode = excluded.layout_mode,
	updated_at = now();

insert into public.quiz_configs (
	quiz_id,
	theme_json,
	lead_steps_json,
	transition_screen_json,
	thank_you_screen_json,
	result_content_json,
	variants_json
)
values
	(
		'military-hearing-check',
		'{
			"pageBackground": "#121212",
			"surface": "#191919",
			"surfaceMuted": "#212121",
			"surfaceStrong": "#0f0f0f",
			"border": "rgba(255,255,255,0.08)",
			"text": "#f6f4ef",
			"textMuted": "#b7b2a8",
			"accent": "#ff8f1f",
			"accentStrong": "#ffb15c",
			"primaryButton": "#4a4d50",
			"primaryButtonText": "#ffffff",
			"secondaryButton": "#2b2e31",
			"secondaryButtonText": "#f6f4ef",
			"selectedButton": "#3b2718",
			"selectedBorder": "#ff8f1f",
			"progressTrack": "#2d2d2d",
			"progressFill": "#ff8f1f",
			"radius": 28,
			"desktopMaxWidth": 880,
			"mobileMaxWidth": 390
		}'::jsonb,
		'[
			{"id":"first-name","label":"What is your first name?","helper":"This helps personalise your review.","kind":"text","required":true,"placeholder":"First name","cta":"Continue"},
			{"id":"phone","label":"What is the best number to reach you on?","helper":"This is only used for this eligibility check.","kind":"phone","required":true,"placeholder":"Phone number","cta":"Continue"},
			{"id":"contact-method","label":"How would you prefer to be contacted?","helper":"Choose what suits you best.","kind":"single","required":true,"cta":"Continue","options":["Phone call","SMS","WhatsApp"],"autoAdvance":true},
			{"id":"best-time","label":"What is the best time to contact you?","helper":"We will use this as your preferred contact window.","kind":"single","required":true,"cta":"Continue","options":["Morning","Afternoon","Evening"],"autoAdvance":true},
			{"id":"email","label":"What is your email address?","helper":"Optional, in case updates need to be sent.","kind":"email","required":false,"placeholder":"Email address","cta":"Continue"}
		]'::jsonb,
		'{"heading":"Thanks, that gives us a clearer picture","body":"A few final details will help with the next step.","trustPoints":["Confidential","Used only for this eligibility check","No obligation"],"cta":"Continue"}'::jsonb,
		'{"heading":"Thank you. Your check has been received.","body":"Your details have been recorded. If appropriate, someone may contact you after review.","primaryCta":"Request a callback","secondaryCta":"Schedule a time instead"}'::jsonb,
		'{
			"likely":{"title":"You may be eligible to claim","body":"Based on your answers, this may be worth reviewing.","primaryCta":"Continue","trustPoints":["Takes around 2 minutes to finish","Confidential","No obligation"]},
			"maybe":{"title":"Your answers may still be worth reviewing","body":"Some answers are less clear, but this may still be worth checking properly.","primaryCta":"Continue","secondaryCta":"Review my answers"},
			"soft-fail":{"title":"This may fall outside the main criteria","body":"One or more of your answers may affect whether this applies to you.","primaryCta":"Continue anyway","secondaryCta":"Review my answers","trustPoints":["If you are unsure, a quick review may still help clarify things."]},
			"hard-fail":{"title":"This check may not apply based on your answer","body":"This route is only for people who served in the UK Armed Forces.","primaryCta":"Change my answer","secondaryCta":"Start again"}
		}'::jsonb,
		'[
			{
				"id":"variant-a",
				"name":"Variant A",
				"description":"Ultra-minimal four-step filter for fast cold-traffic conversion.",
				"weight":70,
				"intro":{"heading":"Hearing worse after service?","subcopy":"Check if your case may be worth reviewing.","trustPoints":["Takes around 2 minutes","Confidential","No obligation"],"cta":"Start check"},
				"questions":[
					{"id":"service-check","kind":"single","prompt":"Did you serve in the UK Armed Forces?","options":[{"id":"yes","label":"Yes"},{"id":"no","label":"No"}]},
					{"id":"served-after-date","kind":"single","prompt":"Did you serve after 15 May 1987?","options":[{"id":"yes","label":"Yes"},{"id":"not-sure","label":"Not sure"},{"id":"no","label":"No"}]},
					{"id":"noise-exposure","kind":"single","prompt":"Were you exposed to loud noise during service?","options":[{"id":"yes","label":"Yes"},{"id":"not-sure","label":"Not sure"},{"id":"no","label":"No"}]},
					{"id":"hearing-worsened","kind":"single","prompt":"Has your hearing worsened since your service?","options":[{"id":"yes","label":"Yes"},{"id":"not-sure","label":"Not sure"},{"id":"no","label":"No"}]}
				]
			},
			{
				"id":"variant-b",
				"name":"Variant B",
				"description":"Expanded six-step qualification flow for stronger signal before lead capture.",
				"weight":30,
				"intro":{"heading":"Hearing worse after service?","subcopy":"Check if your case may be worth reviewing.","trustPoints":["Takes around 2 minutes","Confidential","No obligation"],"cta":"Start check"},
				"questions":[
					{"id":"service-branch","kind":"single","prompt":"Which UK service did you serve in?","options":[{"id":"royal-navy","label":"Royal Navy"},{"id":"british-army","label":"British Army"},{"id":"royal-air-force","label":"Royal Air Force"},{"id":"royal-marines","label":"Royal Marines"},{"id":"not-uk-service","label":"I did not serve in the UK Armed Forces"}]},
					{"id":"served-after-date","kind":"single","prompt":"Did you serve after 15 May 1987?","helper":"If you are unsure, choose Not sure.","options":[{"id":"yes","label":"Yes"},{"id":"no","label":"No"},{"id":"not-sure","label":"Not sure"}]},
					{"id":"noise-exposure-detailed","kind":"multi","prompt":"Were you regularly around loud noise during service?","helper":"Choose all that apply.","options":[{"id":"weapons","label":"Weapons training or live firing"},{"id":"artillery","label":"Artillery or armoured vehicles"},{"id":"aircraft","label":"Aircraft or helicopters"},{"id":"machinery","label":"Engine rooms or heavy machinery"},{"id":"ceremonial","label":"Ceremonial gunfire or parades"},{"id":"other","label":"Other repeated loud noise"},{"id":"none","label":"None of these"}]},
					{"id":"symptoms","kind":"multi","prompt":"Are you dealing with any of these now?","helper":"Choose all that apply.","options":[{"id":"ringing","label":"Ringing in the ears"},{"id":"conversations","label":"Difficulty following conversations"},{"id":"tv-louder","label":"Turning the TV up louder than others"},{"id":"noisy-places","label":"Struggling in noisy places"},{"id":"muffled","label":"Muffled hearing"},{"id":"none","label":"None of these"}]},
					{"id":"hearing-worsened","kind":"single","prompt":"Did your hearing get worse during or after service?","options":[{"id":"yes","label":"Yes"},{"id":"no","label":"No"},{"id":"not-sure","label":"Not sure"}]},
					{"id":"previous-claim","kind":"single","prompt":"Have you already made a hearing loss claim before?","options":[{"id":"yes","label":"Yes"},{"id":"no","label":"No"},{"id":"not-sure","label":"Not sure"}]}
				]
			}
		]'::jsonb
	)
on conflict (quiz_id) do nothing;

insert into public.quiz_domains (quiz_id, hostname, is_primary)
values ('military-hearing-check', 'claims.neptunys.com', true)
on conflict (hostname) do nothing;

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.quiz_configs enable row level security;
alter table public.quiz_domains enable row level security;

drop policy if exists "public can read projects" on public.projects;
create policy "public can read projects"
on public.projects
for select
to anon, authenticated
using (true);

drop policy if exists "members can update projects" on public.projects;
create policy "members can update projects"
on public.projects
for all
to authenticated
using (public.is_project_member(id))
with check (public.is_project_member(id));

drop policy if exists "members can read project memberships" on public.project_members;
create policy "members can read project memberships"
on public.project_members
for select
to authenticated
using (public.is_project_member(project_id));

drop policy if exists "platform admin can manage memberships" on public.project_members;
create policy "platform admin can manage memberships"
on public.project_members
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "public can read published quizzes" on public.quizzes;
create policy "public can read published quizzes"
on public.quizzes
for select
to anon, authenticated
using (status = 'published' or public.is_project_member(project_id));

drop policy if exists "members can update quizzes" on public.quizzes;
create policy "members can update quizzes"
on public.quizzes
for all
to authenticated
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

drop policy if exists "public can read quiz configs" on public.quiz_configs;
create policy "public can read quiz configs"
on public.quiz_configs
for select
to anon, authenticated
using (
	exists (
		select 1
		from public.quizzes quiz
		where quiz.id = quiz_configs.quiz_id
			and (quiz.status = 'published' or public.is_project_member(quiz.project_id))
	)
);

drop policy if exists "members can update quiz configs" on public.quiz_configs;
create policy "members can update quiz configs"
on public.quiz_configs
for all
to authenticated
using (
	exists (
		select 1
		from public.quizzes quiz
		where quiz.id = quiz_configs.quiz_id
			and public.is_project_member(quiz.project_id)
	)
)
with check (
	exists (
		select 1
		from public.quizzes quiz
		where quiz.id = quiz_configs.quiz_id
			and public.is_project_member(quiz.project_id)
	)
);

drop policy if exists "public can read quiz domains" on public.quiz_domains;
create policy "public can read quiz domains"
on public.quiz_domains
for select
to anon, authenticated
using (
	exists (
		select 1
		from public.quizzes quiz
		where quiz.id = quiz_domains.quiz_id
			and (quiz.status = 'published' or public.is_project_member(quiz.project_id))
	)
);

drop policy if exists "members can update quiz domains" on public.quiz_domains;
create policy "members can update quiz domains"
on public.quiz_domains
for all
to authenticated
using (
	exists (
		select 1
		from public.quizzes quiz
		where quiz.id = quiz_domains.quiz_id
			and public.is_project_member(quiz.project_id)
	)
)
with check (
	exists (
		select 1
		from public.quizzes quiz
		where quiz.id = quiz_domains.quiz_id
			and public.is_project_member(quiz.project_id)
	)
);

drop policy if exists "members can read quiz sessions" on public.quiz_sessions;
create policy "members can read quiz sessions"
on public.quiz_sessions
for select
to authenticated
using (
	exists (
		select 1
		from public.quizzes quiz
		where quiz.id = quiz_sessions.quiz_id
			and public.is_project_member(quiz.project_id)
	)
);

drop policy if exists "members can read quiz events" on public.quiz_events;
create policy "members can read quiz events"
on public.quiz_events
for select
to authenticated
using (
	exists (
		select 1
		from public.quizzes quiz
		where quiz.id = quiz_events.quiz_id
			and public.is_project_member(quiz.project_id)
	)
);

drop policy if exists "members can read leads" on public.leads;
create policy "members can read leads"
on public.leads
for select
to authenticated
using (
	exists (
		select 1
		from public.quizzes quiz
		where quiz.id = leads.quiz_id
			and public.is_project_member(quiz.project_id)
	)
);
