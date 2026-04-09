# Neptunys Form

This repository now uses HeyForm as the live form platform.

The active application source lives in `vendor/heyform-upstream` and is tracked by this root repository.
The older custom Vite + Supabase quiz app still exists in the repo, but it is no longer the deployment target for the live form builder/runtime.

## Source Of Truth

- Root git repo: `neptunys-form`
- Active app: `vendor/heyform-upstream`
- Local helper scripts: `scripts/start-heyform-native.ps1` and `scripts/stop-heyform-native.ps1`

## Local Run

Start the native Windows stack:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-heyform-native.ps1
```

Services:

- Webapp: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:9157`
- Mailpit: `http://127.0.0.1:8025`

Stop the local stack:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-heyform-native.ps1
```

## What Was Wired

The HeyForm integration in this repo includes:

- local Windows boot flow without Docker Desktop
- upload persistence under the server static upload directory
- dev proxy support for uploaded assets
- builder and runtime support for uploaded logo/background images
- theme controls for answer radius, button radius, and logo size
- builder preview/runtime fixes so saved theme data is reflected outside the edit canvas

## Free Deployment Recommendation

For full live usage, use a host that runs the HeyForm server container and keep the frontend and backend on the same origin where possible.

Recommended free-ish stack:

1. Backend app: Render web service using `vendor/heyform-upstream/Dockerfile`
2. Database: MongoDB Atlas free tier
3. Redis/Bull: Upstash Redis free tier
4. Frontend: either
   - same backend host via the HeyForm server container, or
   - Vercel only after API/static/logout proxying is configured to the backend host

This repo now includes a ready Render Blueprint in `render.yaml` and a step-by-step deployment guide in `DEPLOY_RENDER.md`.

Important:

- Supabase can be used for other project data, but it does not replace the HeyForm NestJS backend.
- Vercel alone is not enough for full live usage of HeyForm because auth, uploads, GraphQL, and static uploaded assets depend on the backend.

## Git And Deploy Notes

- This root repository now tracks the HeyForm source directly under `vendor/heyform-upstream`.
- The nested upstream `.git` metadata was moved into `.heyform-local/repo-backups` so root git can own the app files.
- If you deploy the frontend on Vercel, point the project at the HeyForm webapp folder or update the root Vercel project to build from that source.

## Next Deployment Step

To finish live deployment from this machine, the remaining external requirements are:

1. a backend hosting account and linked project on a free provider such as Render
2. working git push access to the project GitHub repo
3. a Vercel-authenticated CLI session if you want me to trigger the live frontend deployment from here
