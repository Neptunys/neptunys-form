# Production Cutover Checklist

This runbook is for moving the live Neptunysform stack to a safer production footing before client campaign traffic ramps up.

Related documents:

- `PRODUCTION_SECRETS_INVENTORY.md`
- `PRODUCTION_READINESS_AUDIT.md`

It is written for the current workspace and service layout:

- Render service id: `srv-d7bumfp4tr6s73e61vu0`
- Render service name: `neptunys-form`
- Live readiness URL: `https://form.neptunysengine.com/health/ready`
- Current deploy branch: `main`
- Current Render mode: auto-deploy on commit
- Current Render shape: single instance, Free plan

## Goal

The goal is not just to move off free tiers. The goal is to make production recoverable.

Before cutover, production should have:

- a fresh database backup
- a tested restore path
- secrets stored outside Render
- upload storage verified
- a smoke test plan
- a rollback plan

## Known Local Recovery Assets

These already exist in the workspace and should be used during prep:

- Mongo export helper: `scripts/export-neptunysform-mongo-backup.py`
- Mongo restore validation helper: `scripts/compare-neptunysform-mongo-counts.py`
- Mongo restore helper: `.neptunysform-local/tools/restore-mongo-backup.py`
- Render Mongo URI switch helper: `.neptunysform-local/tools/set-render-mongo-uri.cjs`
- Existing backup snapshot: `.neptunysform-local/repo-backups/neptunysform-local-mongo-export-20260415-200519/`
- Existing smoke status marker: `.neptunysform-local/smoke/smoke-status.json`

The last smoke marker currently records:

- `teamId`: `oHUK3rfp`
- `projectId`: `mpusGTt0`
- `formId`: `Vq7Ft9PG`

## Pre-Cutover Checklist

### 1. Freeze Production Changes

- Pause non-essential production edits.
- Avoid pushing unrelated commits to `main` during the migration window.
- If possible, temporarily disable Render auto-deploy before the migration starts.

### 2. Export and Escrow All Production Secrets

Store all of these outside Render in a password manager or vault:

- `MONGO_URI`
- `REDIS_URL`
- `SESSION_KEY`
- `FORM_ENCRYPTION_KEY`
- `SMTP_*`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_URL`
- domain and DNS settings used for the live app

Minimum rule: Render must not be the only place those values exist.

### 3. Verify Upload Durability

Before cutover, confirm the live app is using S3-compatible object storage and not local fallback behavior.

Check manually in the provider dashboard that:

- the bucket exists
- uploads are still readable from the public URL
- bucket versioning is enabled
- retention or object lock rules are enabled if available
- access keys are documented outside Render

If versioning is not enabled, turn it on before client campaigns.

### 4. Take a Fresh Production Database Backup

Do not rely only on the older local snapshot.

Create a fresh backup immediately before the move using one of these approaches:

1. Atlas snapshot or backup export from the Mongo provider
2. `mongodump` against the current production Mongo URI
3. `scripts/export-neptunysform-mongo-backup.py` if `mongodump` is unavailable locally

Example using `mongodump` if available:

```powershell
mongodump --uri "<CURRENT_PRODUCTION_MONGO_URI>" --db neptunysform --archive="neptunysform-pre-cutover.archive.gz" --gzip
```

Example using the repo helper:

```powershell
python .\scripts\export-neptunysform-mongo-backup.py --uri "<CURRENT_PRODUCTION_MONGO_URI>" --database neptunysform --output-dir ".\.neptunysform-local\repo-backups\neptunysform-pre-cutover-20260418"
```

Store that backup in two places:

- local secured machine storage
- off-machine storage such as OneDrive, S3, R2, or another encrypted archive location

### 5. Prove Restore Works Before the Move

Backups are not sufficient unless restore succeeds.

Restore into a temporary Mongo database or temporary cluster using:

```powershell
python .\.neptunysform-local\tools\restore-mongo-backup.py --uri "<TEMP_MONGO_URI>" --backup-dir ".\.neptunysform-local\repo-backups\neptunysform-local-mongo-export-20260415-200519" --database neptunysform_restore_test --marker ".\.neptunysform-local\tmp-restore-marker.json"
```

Verify after restore:

- forms exist
- submissions exist
- users and teams exist
- record counts are plausible

You can compare source and restored collection counts with:

```powershell
python .\scripts\compare-neptunysform-mongo-counts.py --source-uri "<CURRENT_PRODUCTION_MONGO_URI>" --source-database neptunysform --target-uri "<TEMP_MONGO_URI>" --target-database neptunysform_restore_test
```

If restore is not tested, do not cut over.

### 6. Prepare the New Mongo Target

Before changing production:

- create the paid Mongo target
- enable automated backups
- enable point-in-time restore if the plan supports it
- restrict access to Render egress or approved IP ranges where possible
- create a dedicated database user for the app
- keep admin credentials separate from app credentials

### 7. Prepare the New Render Target or Plan Change

Before cutover:

- move the web service off Free
- prefer an always-on plan
- confirm restart and deploy controls work
- confirm billing is active
- confirm health check remains `/health/ready`

If you keep the same service and only change plan, still treat it like a migration.

### 8. Prepare Monitoring

At minimum, set up alerts for:

- `https://form.neptunysengine.com/health/ready`
- repeated deploy failures
- Mongo backup failures
- bucket or upload failures
- high 5xx rate

This can be external uptime monitoring plus provider-side backup alerts.

### 9. Prepare Submission Smoke Tests

Use the known smoke references where possible:

- `teamId`: `oHUK3rfp`
- `projectId`: `mpusGTt0`
- `formId`: `Vq7Ft9PG`

The smoke test after cutover should verify:

- public form loads
- a real submission is accepted
- submission appears in the dashboard
- integrations or email hooks still fire if they are expected
- CSV/XLSX export still works

## Cutover Procedure

### 1. Start the Change Window

- stop unrelated deploys
- confirm the current site is healthy
- confirm the fresh backup exists
- confirm the restore test already passed

### 2. Update Production to the New Mongo URI

Use the existing helper:

```powershell
node .\.neptunysform-local\tools\set-render-mongo-uri.cjs --uri "<NEW_PRODUCTION_MONGO_URI>"
```

That script updates Render `MONGO_URI` and triggers a `deploy_only` rollout.

### 3. Wait for Health Recovery

Check:

- Render deployment finished successfully
- `https://form.neptunysengine.com/health/ready` returns `status: ok`
- Mongo is reported `up`
- Redis is reported `up`

### 4. Run Immediate Smoke Tests

Verify in this order:

1. public homepage loads
2. target public form loads
3. submit a real test response
4. confirm it appears in the dashboard
5. confirm export works
6. confirm any critical integration or email flow still works

Do not declare success until a real submission round-trip is confirmed.

## Rollback Procedure

Rollback is required if any of these happen:

- health endpoint stays down
- login or dashboard data is missing
- form submissions fail
- newly submitted data is not visible in Mongo or dashboard

Rollback steps:

1. switch `MONGO_URI` back to the previous working URI
2. trigger another `deploy_only` rollout
3. wait for `/health/ready` to recover
4. rerun the same smoke tests

If the new Mongo target received valid writes before rollback, document the exact cutover time so any delta data can be reconciled later.

## Post-Cutover Hardening

After the infrastructure move succeeds, finish these items:

- disable direct production auto-deploy from every commit if possible
- use staging plus manual promotion for production releases
- tighten CORS to an allowlist instead of any-origin credentials
- replace blanket frame/CSP disablement with explicit embed domain policy
- require captcha on public campaign forms
- document monthly restore drills

## Ongoing Backup Standard

Minimum acceptable operating standard after cutover:

- automated Mongo backups enabled
- restore drill performed monthly
- upload bucket versioning enabled
- secrets escrowed outside Render
- smoke test run after every production database or hosting change

## No-Go Conditions

Do not perform the paid cutover yet if any of these are still true:

- no fresh production backup exists
- restore has not been tested
- S3 or bucket setup is still unverified
- production secrets are only stored in Render
- nobody is available to run and verify the smoke tests
