# NeptunysForm Replacement Plan

## Decision

Replace the current custom builder and runtime with NeptunysForm as the form product.

Do not continue expanding the in-repo builder as the primary path to production.

## Why

- NeptunysForm already covers the required product surface: branching logic, embed, custom domains, mobile and desktop layouts, branding controls, webhooks, and a wide element set.
- The current repo still spends most of its complexity budget on builder and renderer behavior.
- A partial transplant into the existing schema would still be a rewrite.
- The fastest path to operational use is adopting NeptunysForm directly and treating this repo as legacy or optional shell code.

## Current Safety Point

- Existing custom app checkpoint saved to GitHub on `main` at commit `998083b`.
- This commit is the rollback point before the NeptunysForm transition.

## Chosen Path

### Phase 1: Operational Fastest

1. Stand up NeptunysForm separately.
2. Rebuild the live production form manually in NeptunysForm.
3. Reapply branding using the current palette, logo, background, and typography direction.
4. Configure branching and end screens inside NeptunysForm.
5. Connect webhook automation.
6. Point the desired domain or subdomain to the NeptunysForm deployment.

### Phase 2: Decide What Survives Here

Keep this repo only if needed for:

- admin shell or dashboard around forms
- custom reporting
- custom landing pages
- automation helpers or edge functions

Remove this repo from the critical path for:

- form builder UX
- preview renderer
- quiz runtime renderer
- branching UI

## Minimum Production Requirements

The replacement must support all of the following before the old flow is considered retired:

- embedded branching logic
- page-by-page conversational flow
- desktop and mobile behavior
- custom branding and theme controls
- custom domain support
- automation via webhook or integration
- broad set of field types

## Upstream Reference

Local NeptunysForm upstream clone used for analysis:

- `vendor/neptunysform-upstream/`

Important upstream areas:

- builder: `vendor/neptunysform-upstream/packages/webapp/src/pages/form/Builder/`
- renderer: `vendor/neptunysform-upstream/packages/form-renderer/src/`
- embed: `vendor/neptunysform-upstream/packages/embed/src/`
- webhook integration: `vendor/neptunysform-upstream/packages/server/src/apps/webhook.ts`
- theme contract: `vendor/neptunysform-upstream/packages/shared-types-enums/src/form.ts`

## Local Boot

Use the helper scripts from this repo root:

1. `powershell -ExecutionPolicy Bypass -File .\scripts\start-neptunysform-local.ps1`
2. Open `http://localhost:9513`
3. Open `http://localhost:8025` to catch verification emails in Mailpit
4. Stop with `powershell -ExecutionPolicy Bypass -File .\scripts\stop-neptunysform-local.ps1`

Required local dependency:

- Docker Desktop with a running engine

## Native Windows Boot

The free native Windows path is now validated on this machine.

Use the native helper scripts from this repo root:

1. `powershell -ExecutionPolicy Bypass -File .\scripts\start-neptunysform-native.ps1`
2. Open `http://127.0.0.1:3000`
3. Open `http://127.0.0.1:8025` for Mailpit
4. Stop with `powershell -ExecutionPolicy Bypass -File .\scripts\stop-neptunysform-native.ps1`

Required local dependencies for the native path:

- MongoDB running locally on `127.0.0.1:27017`
- Redis service running locally on `127.0.0.1:6379`
- Mailpit installed via `winget`
- `corepack pnpm` available

Current validated local ports:

- webapp: `3000`
- server: `9157`
- Mailpit UI: `8025`
- Mailpit SMTP: `1025`

For local verification emails, NeptunysForm sends mail into Mailpit instead of a real external mailbox.
Open `http://127.0.0.1:8025` to read the verification code.

## Free Setup Options

There is no requirement to pay for Docker to make this migration work.

### Recommended fastest free path

Use a free container runtime and keep the existing compose-based boot flow.

Best option:

1. Rancher Desktop

Why:

- free
- easiest match for the current compose workflow
- avoids spending time hand-installing MongoDB and Redis-compatible services
- best chance of getting operational fastest

Alternative:

1. Podman Desktop

Why not the first choice:

- also free
- workable, but compose and Docker-compatibility tend to require a bit more adjustment on Windows

### Strict no-container path

This is also possible and still free, but slower:

1. Use `corepack pnpm` for the workspace package manager
2. Install MongoDB Community Server
3. Install a Redis-compatible local service
4. Run the NeptunysForm server and webapp natively

Notes:

- `corepack pnpm` already works on this machine
- MongoDB Community is available via `winget`
- Redis on native Windows is the awkward part; that is why the free container path is faster

### Free cloud path

For testing only, a free hosted combination is also possible:

1. MongoDB Atlas free tier
2. Upstash or another free Redis tier

This avoids local infra entirely, but requires external accounts and is not the fastest for an offline local workflow.

## Recommendation

If the goal is operational ASAP without paying:

1. Use the native Windows boot path that is already working locally
2. Keep the compose path only as a fallback if you later want isolated containerized infra
3. Move straight into account setup, branding, branching, and webhook configuration

## Branding Mapping

Map the current builder theme into NeptunysForm theme settings as follows:

- current `fontFamily` -> NeptunysForm `theme.fontFamily`
- current `textColor` -> NeptunysForm `theme.questionTextColor`
- current `answerTextColor` -> NeptunysForm `theme.answerTextColor`
- current `buttonColor` -> NeptunysForm `theme.buttonBackground`
- current `buttonTextColor` -> NeptunysForm `theme.buttonTextColor`
- current `backgroundColor` -> NeptunysForm `theme.backgroundColor`
- current `backgroundImage` -> NeptunysForm `theme.backgroundImage`
- current `backgroundBrightness` -> NeptunysForm `theme.backgroundBrightness`
- current `logoImage` -> NeptunysForm `theme.logo`

Items without a direct first-class field in NeptunysForm should be handled with custom CSS after the base migration:

- button border color
- answer border color
- custom corner radius exactness
- content offset tuning

## Migration Rule

If a requirement already exists in NeptunysForm, prefer configuring it there instead of rebuilding it here.
