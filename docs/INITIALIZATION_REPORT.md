# SWARM Initialization Report

## Status

Initialization inspection, architecture, schema, policy documentation and backlog are complete. A new private repository was created at https://github.com/amerkallajo/swarm with 20 prioritized issues. No business was contacted, no real email was sent, no mass scrape ran, no preview was built or published, and no paid resource was created.

Overall production readiness: **26%**. This is a weighted readiness estimate: inspection 8/8, architecture/docs 10/10, repository/backlog 4/4, verified base integrations 4/14, and 0 points so far for implemented safety foundation, isolated data infrastructure, compliance approval and tested pilot. Operational outreach readiness remains **0%** because outbound software and approvals are not implemented.

## Discovered

- The local workspace was empty and no older SWARM repository/code was found in the connected GitHub account.
- Reusable patterns exist in `econicmedia` (audit/checklist concepts), `cheflight` (Zod validation and fail-closed Supabase storage fallback), and `tatiana-garder-steuerberatung` (Netlify configuration). They require review before reuse.
- GitHub CLI is authenticated as `amerkallajo` with repository/workflow scopes.
- Netlify CLI is authenticated, but SWARM has no linked site. Existing sites are unrelated.
- Supabase CLI can list one unrelated trading project. SWARM must use a new isolated project.
- Gmail integration is not configured.
- Apify has no runtime environment credential/CLI configured for SWARM.

## Proposed architecture

A TypeScript pnpm/Turborepo modular monolith: Next.js operator dashboard, durable Node worker, shared domain/policy packages, isolated Supabase Postgres/Auth/Storage, PostgreSQL job leases, Apify adapters, Playwright/Lighthouse/axe audits, Gmail OAuth, Telegram control, and immutable expiring Netlify previews. All external side effects require policy, approval, idempotency and reconciliation.

## Security concerns

The Telegram and Apify credentials were pasted into chat and should be rotated before use. They were not written to the repository. The existing Hermes Telegram environment credential resolves to `@ccclowdbot`, is not proven to be the dedicated SWARM bot, and returned no candidate chat. Secret scanning is not yet installed locally/CI. Gmail OAuth, isolated Supabase, SWARM Netlify site, suppression enforcement and outbound policy code do not yet exist.

## Telegram delivery result

The initialization report was **not sent to Telegram**. Exact reasons:

1. The dedicated token supplied in chat is not present as `TELEGRAM_BOT_TOKEN` in the SWARM process/runtime secret store; using a literal token from chat would violate the required secret-loading rule.
2. The only existing Hermes Telegram credential belongs to a different/unverified bot (`@ccclowdbot`).
3. That bot returned no candidate chat, so there is no verified/allowlisted destination.

Required recovery: rotate the chat-posted token, configure the new value in the SWARM runtime secret store, start the dedicated bot from Amer's Telegram account, then verify and allowlist the exact user/chat IDs. The report can then be sent without exposing the token.

## Recommended first phase

Implement the fail-closed foundation first: monorepo/CI, transition state machine, append-only events, suppression, approvals, durable jobs, send intents/reconciliation, pause/shutdown and policy tests. Do not connect Gmail send scope or run live Apify discovery until these gates pass.

## Decisions required

Approve the stack and repository name; approve an isolated Supabase project and region; rotate and configure Telegram/Apify credentials; choose the first market/industry/language; choose sender mailbox/legal identity; approve Gmail scopes; set approvers and budgets; obtain jurisdiction-specific compliance approval; and define preview/pricing/contract rules.

## Exact next autonomous action

Begin GitHub issue #1: bootstrap the pnpm/Turborepo monorepo with strict TypeScript and zero outbound capability, then run lint, typecheck, unit tests and build in CI before touching any external lead data.
