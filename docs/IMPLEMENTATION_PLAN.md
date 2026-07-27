# SWARM Implementation Plan

## Goal

Deliver a restartable, auditable, approval-gated system that can run a tiny shadow pilot before any real outreach.

## Phase 0 — Initialization (complete)

Inspect workspace/accounts, identify reusable assets, document architecture/schema/policies/costs, create backlog and establish a private repository. Verify no outreach or mass scraping occurred.

## Phase 1 — Safe foundation

Bootstrap pnpm/Turborepo, shared TypeScript/config packages, CI, secret scanning and tests. Create a separate development Supabase project after approval, migrations, RLS, status transition function, suppression, approval, job leasing and audit events. Implement global pause/shutdown and policy tests first.

Exit: database can prove that unapproved, duplicate, paused and suppressed sends are rejected.

## Phase 2 — Read-only discovery and auditing

Build one tiny-source adapter using fixtures before any live Apify call. Implement canonicalization/dedupe, activity/contact validation, SSRF-safe fetch, Playwright/Lighthouse/axe audit, evidence storage, scoring v1 and operator lead view.

Exit: a fixed test corpus produces reproducible evidence, scores and rejection reasons with no outbound side effects.

## Phase 3 — Telegram and Gmail shadow mode

Configure the dedicated rotated Telegram bot and allowlist. Add approval inbox/commands. Configure Gmail OAuth with draft/read scopes; ingest synthetic or operator-owned test threads. Generate drafts but do not send.

Exit: approvals are payload-bound/expiring, opt-outs suppress immediately, and shadow drafts pass factual/policy review.

## Phase 4 — Controlled pilot

After market/legal approval, enable a tiny manually selected cohort. Every first send has two human checks (lead and exact draft), strict daily/domain caps, one follow-up maximum and real-time reconciliation.

Exit: zero policy violations/duplicates, acceptable bounce/complaint rates and documented quality review.

## Phase 5 — Preview pipeline

Create vetted templates, asset provenance, concept labels, QA budgets, immutable builds and expiring Netlify deploys. Use only interested leads with create/publish/send approvals.

Exit: a synthetic preview passes QA and teardown; then one real interested lead may be approved.

## Phase 6 — Optimization

Calibrate scoring against outcomes, test message variants, add cost-per-stage reporting and selectively automate low-risk approvals only after measured safety.

## Verification strategy

Unit tests for score/policy/state transitions; property tests for illegal transitions/idempotency; integration tests against local Postgres and mocked vendors; Playwright for dashboard/previews; contract tests for adapters; chaos tests for crash-after-send/deploy; migration/RLS tests; secret and dependency scans in CI.

## Autonomous work allowed now

Repository/tooling bootstrap, domain types, local migrations, deterministic policy/state-machine tests, fixture-based discovery/audit/scoring, dashboard skeleton, redaction, cost ledger, synthetic preview templates and CI—without external sends, live scraping, paid resources or real-business artifacts.
