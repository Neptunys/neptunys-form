# Production Readiness Audit

This document captures the current production posture based on the codebase, local Render metadata, recovery tooling in the workspace, and the live readiness check performed on 2026-04-18.

## Overall Verdict

Current state: `Not yet campaign-safe`

Why:

- the live service is healthy right now
- submission persistence is better than the rest of the stack because writes happen before async queues
- recovery helpers exist locally
- but hosting, backup assurance, upload durability, release discipline, and security hardening are still below the bar for a high-stakes client campaign system

## Current Snapshot

- Live readiness endpoint returned `status: ok` with Mongo and Redis both up during the latest audit check.
- Render service metadata shows auto-deploy enabled in `.heyform-local/render-service.json`.
- Render service metadata shows one instance and Free plan in `.heyform-local/render-service.json`.
- Local restore and repoint helpers exist under `.heyform-local/tools/`.
- A local Mongo export snapshot exists under `.heyform-local/repo-backups/heyform-local-mongo-export-20260415-200519/`.

## Audit Table

| Area | Status | Evidence | Meaning | Required action |
| --- | --- | --- | --- | --- |
| Live app health | Pass | `.heyform-local/render-service.json`, `render.yaml`, latest `/health/ready` check | Service is currently reachable and dependencies are up | Keep external monitoring on it |
| Submission write ordering | Pass | `vendor/heyform-upstream/packages/server/src/resolver/endpoint/complete-submission.resolver.ts` | Submission is persisted before async queue work fires | Keep this invariant during future changes |
| Render hosting tier | Fail | `.heyform-local/render-service.json`, `render.yaml` | Current service remains single-instance Free | Move off Free before serious campaign load |
| Production release safety | Fail | `.heyform-local/render-service.json`, `render.yaml` | Auto-deploy from `main` is active | Use staging plus manual production promotion |
| Mongo backup automation | Unverified | no provider-side backup evidence in workspace | Cannot prove backup schedule or PITR | Verify provider backup policy before cutover |
| Restore tooling | Pass | `.heyform-local/tools/restore-mongo-backup.py` | Local restore capability exists | Run and document a fresh restore drill |
| Fresh restore drill | Fail | no recent successful restore marker for current live data | Backup usefulness is not yet proven for this cutover cycle | Run restore test before any provider or plan move |
| Local emergency backup snapshot | Partial | `.heyform-local/repo-backups/heyform-local-mongo-export-20260415-200519/manifest.txt` | There is at least one export snapshot, but it is not enough by itself | Create a fresh pre-cutover backup |
| Upload object durability | Unverified | `vendor/heyform-upstream/packages/server/src/config/upload/index.ts` | App supports S3-backed uploads, but provider state is not verified here | Confirm live bucket, versioning, retention, and access escrow |
| Upload fallback risk | Fail | `vendor/heyform-upstream/packages/server/src/config/upload/index.ts` | If S3 config is absent or broken, storage falls back away from durable object storage | Verify live `S3_*` config and bucket setup |
| Secret escrow outside Render | Unverified | `render.yaml`, previous env-loss memory, no vault inventory yet | Cannot prove recovery secrets are safely stored outside Render | Complete `PRODUCTION_SECRETS_INVENTORY.md` |
| Cookie baseline | Pass | `vendor/heyform-upstream/packages/server/src/config/cookie/index.ts` | Secure production cookies and `httpOnly` session cookies are already in place | Keep this as baseline |
| CORS hardening | Fail | `vendor/heyform-upstream/packages/server/src/main.ts` | Any origin with credentials is too open for production | Replace with explicit allowlist |
| Frame/CSP hardening | Fail | `vendor/heyform-upstream/packages/server/src/main.ts` | Frameguard and CSP are disabled globally | Replace with explicit embed-safe policy |
| Global rate limiting | Partial | `vendor/heyform-upstream/packages/server/src/main.ts` | There is a limiter, but current threshold is generous | Tune for public campaign traffic |
| Bot protection defaults | Fail | `vendor/heyform-upstream/packages/server/src/resolver/form/create-form.resolver.ts`, `vendor/heyform-upstream/packages/server/src/resolver/endpoint/complete-submission.resolver.ts` | New forms default to no captcha | Turn captcha on for campaign forms by default or by policy |
| Spam filtering hook | Partial | `vendor/heyform-upstream/packages/server/src/service/endpoint.service.ts` | Akismet and recaptcha hooks exist, but usage depends on config and form settings | Verify live configuration and campaign defaults |
| External monitoring and alerting | Unverified | no telemetry provider integration found in server source | No evidence of robust alerting from workspace alone | Add uptime, deploy-failure, backup, and 5xx alerts |
| Smoke test artifact | Partial | `.heyform-local/smoke/smoke-status.json` | A previous smoke run exists, but not as a formal pre-cutover check | Rerun after every infra change |
| Rollback tooling | Partial | `.heyform-local/tools/set-render-mongo-uri.cjs` | URI rollback path exists for Mongo target changes | Pair it with a written rollback trigger and operator checklist |

## Highest-Risk Findings

### 1. Free single-instance production hosting

Evidence:

- `.heyform-local/render-service.json` shows `numInstances: 1`
- `.heyform-local/render-service.json` shows `plan: free`
- `render.yaml` declares `plan: free`

Risk:

- cold starts
- weak uptime posture
- no redundancy
- more operational fragility during campaign traffic

### 2. Production auto-deploy still active

Evidence:

- `.heyform-local/render-service.json` shows `autoDeploy: yes`
- `render.yaml` shows `autoDeployTrigger: commit`

Risk:

- an unrelated push can change production during a migration window
- no release gate between staging confidence and production exposure

### 3. Security policy is too permissive

Evidence from `vendor/heyform-upstream/packages/server/src/main.ts`:

- CORS origin is set to `true`
- credentials are enabled
- frameguard is disabled
- content security policy is disabled

Risk:

- excessive cross-origin trust
- looser browser protection than needed for a production admin and public form system

### 4. Backup posture is not yet provable

Evidence:

- there is local restore tooling
- there is an older export snapshot
- there is no provider backup confirmation or fresh restore proof in this workspace

Risk:

- recovery plan exists on paper, but may still fail under time pressure

## Pass Criteria Before Cutover

The system should not be treated as campaign-safe until all of these are true:

- Render is no longer Free and no longer treated as uncontrolled auto-release
- Mongo backups are verified and restore has been tested during this cutover cycle
- upload storage is confirmed live, durable, and versioned
- secrets are escrowed outside Render
- external monitoring and alerting are active
- the post-cutover smoke test is defined and assigned to an operator

## Recommended Execution Order

1. Complete `PRODUCTION_SECRETS_INVENTORY.md`
2. Take a fresh production Mongo backup
3. Run a restore drill to a temporary target
4. Verify live S3 or R2 bucket settings and versioning
5. Freeze production deploy churn
6. Move Mongo to the paid target and verify health plus smoke tests
7. Move Render off Free and keep production release gating tighter afterward
8. Finish CORS, CSP, and bot-protection hardening
