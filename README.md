# Neptunys Quizz

Neptunys Quizz is a React + Supabase quiz funnel focused on military hearing-loss paid traffic. It includes:

- Variant A and Variant B quiz flows
- Embedded analytics events and drop-off tracking
- Progressive lead capture
- Admin dashboard with lead export and funnel reporting
- Supabase-ready schema and deployment setup

## Quick start

```bash
npm install
npm run dev
```

## Environment

Copy `.env.example` to `.env` and set the Supabase keys when ready. The app can still run in demo mode without them.

For admin access, set both `VITE_ADMIN_EMAIL` and `VITE_ADMIN_PASSWORD` for a local dashboard login, or leave both unset and use Supabase Auth email/password login instead. There is no built-in fallback password.

Required variables:

- `VITE_SUPABASE_URL`: Supabase project URL used for shared project registry, leads, and Edge Functions
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key used by the frontend client
- `VITE_ADMIN_EMAIL`: Optional local-only admin login email when not using Supabase Auth
- `VITE_ADMIN_PASSWORD`: Optional local-only admin login password when not using Supabase Auth

## Persistence

The app always works in local demo mode through browser local storage. For shared persistence across devices and deployments, configure Supabase and apply the SQL migrations in [supabase/migrations](supabase/migrations).

Important: builder theme persistence now depends on the migration at [supabase/migrations/202604080002_add_builder_design_json.sql](supabase/migrations/202604080002_add_builder_design_json.sql). Apply that migration before using the admin builder against a remote registry.

## GitHub And Deploy

Recommended flow:

1. Push this repository to GitHub.
2. Import the repo into Vercel.
3. Add the environment variables from `.env.example` in the Vercel project settings.
4. Apply the Supabase migrations, including [supabase/migrations/202604080002_add_builder_design_json.sql](supabase/migrations/202604080002_add_builder_design_json.sql).
5. Redeploy so the admin app and shared theme registry persist remotely.

## Deploy

- Frontend: Vercel
- Backend: Supabase
- Notifications: Resend or webhook automation

## Brand system

The app now uses a shared brand system derived from the builder UI so the home, builder, and shared primitives stay visually aligned.

- Palette: obsidian backgrounds, smoke panels, porcelain text, orchid accent, electric-blue signal color
- Typography: San Francisco for both interface copy and display headings
- Surfaces: soft layered dark panels with subtle inner highlights instead of flat greys
- Interactive states: orchid for selected/brand emphasis, blue for signal/progress/action feedback
- Principle: new UI should use shared tokens in [src/styles/tokens.css](src/styles/tokens.css) and shared primitives in [src/styles/global.css](src/styles/global.css) instead of introducing local hardcoded colors
