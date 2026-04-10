# Render Deploy

This repo is set up to run the full HeyForm app as a single Render web service.

That is the cleanest free deployment path because the HeyForm server handles:

- GraphQL
- auth and session cookies
- file uploads
- public uploaded asset URLs
- the built frontend app

## Recommended Stack

Use these external services with the included `render.yaml` Blueprint:

1. Render web service for the app container
2. MongoDB Atlas free tier for `MONGO_URI`
3. Upstash Redis free tier for `REDIS_URL`
4. Cloudflare R2 or another S3-compatible bucket for uploads

## Why Not Frontend-Only Vercel

The current production-safe path is a same-origin deployment.

Running only the webapp on Vercel would require extra proxying and cookie-domain work for:

- `/graphql`
- `/api/upload`
- `/logout`
- uploaded asset URLs

That can be done later, but it is not the shortest route to a stable live app.

## Required Environment Values

The included Blueprint prompts for these values:

- `MONGO_URI`
- `REDIS_URL`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_URL`
- `OPENAI_API_KEY` if you want AI form creation enabled

The Blueprint generates these automatically:

- `SESSION_KEY`
- `FORM_ENCRYPTION_KEY`

The app now also supports:

- platform `PORT` values such as Render's default `10000`
- `RENDER_EXTERNAL_URL` as the default homepage URL
- a single `REDIS_URL`, including TLS `rediss://` URLs from providers like Upstash
- `OPENAI_GPT_MODEL` if you want to override the default AI model

## S3-Compatible Upload Notes

For a free deployment, do not rely on the web service filesystem for uploads.

Use an S3-compatible bucket and set:

- `S3_ENDPOINT` to the provider API endpoint
- `S3_REGION` to the provider region value
- `S3_BUCKET` to the bucket name
- `S3_ACCESS_KEY_ID` to the bucket access key
- `S3_SECRET_ACCESS_KEY` to the bucket secret
- `S3_PUBLIC_URL` to the public base URL used to serve uploaded files

Example for Cloudflare R2:

- `S3_ENDPOINT`: `https://<account-id>.r2.cloudflarestorage.com`
- `S3_REGION`: `auto`
- `S3_PUBLIC_URL`: your public bucket URL or custom domain that serves the uploaded objects

## Deploy Steps

1. Push the latest repo changes to GitHub.
2. In Render, create a new Blueprint deployment from the `Neptunys/neptunys-form` repository.
3. Render will detect `render.yaml` at the repo root.
4. Fill in the prompted secret values.
5. Deploy the `neptunys-form` web service.
6. After the service is live, open the Render service URL and create the first HeyForm admin account.

## Optional Later Work

- Add SMTP if you want email verification, password reset, or email notifications.
- Add a custom domain and set `APP_HOMEPAGE_URL` explicitly if you do not want to rely on the Render default external URL.
- Add a Vercel frontend later only if you specifically want a split frontend/backend setup.