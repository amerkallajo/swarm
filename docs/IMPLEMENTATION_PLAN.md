# SWARM Implementation Plan

## Goal

Reach one strong real prospect through a bounded, evidence-driven, approval-gated pilot while
preserving the long-term restartable architecture as post-validation direction.

## Current priority — fast-track pilot

The immediate sequence is:

1. minimal durable lead/evidence storage with source timestamps and duplicate-contact prevention;
2. fixture-first worldwide opportunity comparison followed by a bounded cohort of about 30
   businesses in the strongest evidence-selected market and lawful vertical;
3. activity validation for 15, concise website audits for 10, and deterministic pilot scoring;
4. five evidence-backed leads presented to Amer and three exact localized DE/EN/AR drafts;
5. Amer-only Telegram approval shadow flow and Gmail draft-only/manual-send fallback;
6. one real contact only after Amer approves the exact prospect, recipient, message, and channel;
7. attempt recording, provider reconciliation, and reply monitoring.

See [`FAST_TRACK_PILOT.md`](FAST_TRACK_PILOT.md). Full CRM, distributed infrastructure, broad
rollout beyond the selected pilot cohort, automated follow-ups, advanced analytics, and preview
automation are deferred unless they become a concrete blocker.

## Phase 0 — Initialization (complete)

Inspect workspace/accounts, identify reusable assets, document architecture/schema/policies/costs,
create the backlog, and establish the repository. The repository was later made public under Amer's
explicit approval to enable public-repository security features. Verify no outreach or mass scraping
occurred.

## Foundation already delivered

The pnpm/Turborepo foundation, strict TypeScript, protected CI, secret scanning, CodeQL, dependency
review, and immutable fail-closed lead transition matrix are delivered. The larger database, queue,
and enterprise-control layers are no longer prerequisites for beginning the bounded read-only pilot.

The minimum remaining safety foundation is durable pilot state, suppression and duplicate-contact
prevention, payload-bound approvals, pause/shutdown, bounded budgets, and send reconciliation before
the first real contact.

## Pilot phase 1 — Read-only discovery, validation, audit and scoring

Build one bounded source adapter using fixtures before any live Apify call. Implement only the
canonicalization/dedupe, evidence provenance, activity/contact checks, safe fetching, concise
business-impact audit, and simple 100-point score needed for the 30/15/10/5 funnel.

Exit: a fixed test corpus and then a bounded read-only cohort produce reproducible evidence, scores,
hard exclusions, and rejection reasons with no outbound side effects.

## Pilot phase 2 — Approval and draft-only mode

Configure a dedicated rotated Telegram bot only when its identity and Amer's allowlisted IDs are
verified. Implement the compact pilot commands and approval cards. Configure Gmail with read/draft
scope or produce an exact manual-send artifact. Generate drafts but do not send.

Exit: approvals are payload-bound/expiring, opt-outs suppress immediately, and shadow drafts pass factual/policy review.

## Pilot phase 3 — One controlled contact

After market/legal identity and jurisdiction gates, ask Amer to approve one exact business,
recipient, message, and channel. Create one immutable intent, contact once, persist provider evidence,
and reconcile uncertainty before any retry. No automatic second prospect or follow-up.

Exit: one professional contact is recorded without duplication, reply monitoring exists, and the
result is reviewed before any expansion.

## Pilot phase 4 — Preview only after interest

For the first prospect who expresses interest, create one high-impact unofficial homepage concept
with licensed assets, `noindex`, bounded lifetime, and separate create/publish/send approvals.

Exit: a synthetic preview passes QA and teardown; then one real interested lead may be approved.

## Post-validation architecture and optimization

Resume deferred database breadth, queues, CRM, multi-tenancy, preview automation, additional markets,
analytics, and selective low-risk automation only after measured pilot evidence justifies them.

## Verification strategy

Unit tests for score/policy/state transitions; property tests for illegal transitions/idempotency; integration tests against local Postgres and mocked vendors; Playwright for dashboard/previews; contract tests for adapters; chaos tests for crash-after-send/deploy; migration/RLS tests; secret and dependency scans in CI.

## Autonomous work allowed now

Pilot documentation, minimal durable schema, fixture discovery, bounded read-only collection,
activity validation, evidence-backed auditing/scoring, synthetic Telegram approval cards, and exact
draft generation—without external sends, mass scraping, paid resources, public deployment, or
real-business previews. Real contact remains separately approval-gated.
