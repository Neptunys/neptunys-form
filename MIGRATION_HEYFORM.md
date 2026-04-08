# HeyForm Replacement Plan

## Decision

Replace the current custom builder and runtime with HeyForm as the form product.

Do not continue expanding the in-repo builder as the primary path to production.

## Why

- HeyForm already covers the required product surface: branching logic, embed, custom domains, mobile and desktop layouts, branding controls, webhooks, and a wide element set.
- The current repo still spends most of its complexity budget on builder and renderer behavior.
- A partial transplant into the existing schema would still be a rewrite.
- The fastest path to operational use is adopting HeyForm directly and treating this repo as legacy or optional shell code.

## Current Safety Point

- Existing custom app checkpoint saved to GitHub on `main` at commit `998083b`.
- This commit is the rollback point before the HeyForm transition.

## Chosen Path

### Phase 1: Operational Fastest

1. Stand up HeyForm separately.
2. Rebuild the live production form manually in HeyForm.
3. Reapply branding using the current palette, logo, background, and typography direction.
4. Configure branching and end screens inside HeyForm.
5. Connect webhook automation.
6. Point the desired domain or subdomain to the HeyForm deployment.

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

Local HeyForm upstream clone used for analysis:

- `vendor/heyform-upstream/`

Important upstream areas:

- builder: `vendor/heyform-upstream/packages/webapp/src/pages/form/Builder/`
- renderer: `vendor/heyform-upstream/packages/form-renderer/src/`
- embed: `vendor/heyform-upstream/packages/embed/src/`
- webhook integration: `vendor/heyform-upstream/packages/server/src/apps/webhook.ts`
- theme contract: `vendor/heyform-upstream/packages/shared-types-enums/src/form.ts`

## Local Boot

Use the helper scripts from this repo root:

1. `powershell -ExecutionPolicy Bypass -File .\scripts\start-heyform-local.ps1`
2. Open `http://localhost:9513`
3. Open `http://localhost:8025` to catch verification emails in Mailpit
4. Stop with `powershell -ExecutionPolicy Bypass -File .\scripts\stop-heyform-local.ps1`

Required local dependency:

- Docker Desktop with a running engine

## Branding Mapping

Map the current builder theme into HeyForm theme settings as follows:

- current `fontFamily` -> HeyForm `theme.fontFamily`
- current `textColor` -> HeyForm `theme.questionTextColor`
- current `answerTextColor` -> HeyForm `theme.answerTextColor`
- current `buttonColor` -> HeyForm `theme.buttonBackground`
- current `buttonTextColor` -> HeyForm `theme.buttonTextColor`
- current `backgroundColor` -> HeyForm `theme.backgroundColor`
- current `backgroundImage` -> HeyForm `theme.backgroundImage`
- current `backgroundBrightness` -> HeyForm `theme.backgroundBrightness`
- current `logoImage` -> HeyForm `theme.logo`

Items without a direct first-class field in HeyForm should be handled with custom CSS after the base migration:

- button border color
- answer border color
- custom corner radius exactness
- content offset tuning

## Migration Rule

If a requirement already exists in HeyForm, prefer configuring it there instead of rebuilding it here.
