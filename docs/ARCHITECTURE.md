# Architecture

## Decision

Use a TypeScript monorepo and a modular monolith with two deployables: an operator dashboard/API and a durable worker. This minimizes cost and complexity while preserving package boundaries that can later become services.

## Components

- `apps/dashboard`: Next.js authenticated CRM, evidence viewer, approval inbox, settings, health and cost dashboards.
- `apps/worker`: scheduled jobs, discovery adapters, validation, audits, scoring, reply ingestion, follow-up checks, and preview orchestration.
- `packages/domain`: state machine, commands, events, policy decisions, shared types.
- `packages/database`: typed repositories, migrations, transactions, idempotency and job leasing.
- `packages/discovery`: Apify/public-source adapters with provenance and source terms.
- `packages/validation`: identity, activity, closure, contact and deduplication checks.
- `packages/audit`: HTTP/TLS/DNS, Playwright, Lighthouse, axe and structured content checks.
- `packages/scoring`: versioned rules, evidence links and explanations.
- `packages/outreach`: fact-bound drafts, templates, policy checks and follow-up limits.
- `packages/gmail`: OAuth, send/draft, thread sync, reply classification and reconciliation.
- `packages/telegram`: signed callback approvals, commands, alerts and RBAC.
- `packages/previews`: brief, asset provenance, template generation, QA and Netlify deployment.
- `packages/compliance`: suppression, jurisdiction rules, retention, lawful-basis records.
- `packages/observability`: structured redacted logs, metrics, alerts and cost ledger.

## Runtime and data flow

1. Scheduler creates a bounded discovery job.
2. Adapter stores immutable source observations with retrieval time and URL.
3. Validator resolves a canonical business and rejects closed/fake/duplicate/ineligible records.
4. Auditor records measurable findings and artifacts.
5. Versioned scorer produces component scores, penalties, confidence and explanation.
6. Qualified lead moves to `AWAITING_APPROVAL`; no outbound action exists yet.
7. An authorized Telegram/dashboard decision creates an approval record.
8. Outreach service creates a draft only from cited evidence. A second approval is required for the first real send.
9. Gmail sender atomically claims a send intent, checks suppression and policy again, sends once, and reconciles the provider message/thread IDs.
10. Replies are ingested and classified; uncertain intent routes to a person.
11. Interested leads may enter preview planning only after approval. Build, QA, publish and send are separate gates.

## State machine

Canonical statuses: `DISCOVERED`, `VALIDATING`, `REJECTED`, `QUALIFIED`, `AWAITING_APPROVAL`, `APPROVED_FOR_OUTREACH`, `CONTACTED`, `REPLIED`, `INTERESTED`, `PREVIEW_PLANNED`, `PREVIEW_IN_PROGRESS`, `PREVIEW_REVIEW`, `PREVIEW_SENT`, `NEGOTIATING`, `WON`, `LOST`, `DO_NOT_CONTACT`, `FOLLOW_UP_LATER`.

Transitions are commands validated by a transition table. Terminal suppression states cannot transition to outreach states. Every transition writes an append-only event with actor, reason, evidence and correlation ID in the same transaction as the current-state update.

## Queue and restartability

Use a PostgreSQL job table with `FOR UPDATE SKIP LOCKED`, leases, heartbeats, maximum attempts, exponential backoff and dead-letter state. Each external side effect has an idempotency key and a two-stage `intent -> provider result -> reconciled` record. Recovery reconciles uncertain sends/deployments before retrying.

## Deployment topology

- Dashboard: Netlify initially.
- Worker: local development, then a low-cost always-on container host when approved.
- Database/Auth/Storage: a new isolated Supabase project, not the existing trading project.
- Previews: separate Netlify team/site namespace and concept subdomains.
- CI: GitHub Actions for lint, typecheck, tests, migrations, secret scan and dependency review.

## Trust boundaries

Browser-fetched content is untrusted data, never agent instruction. Public pages are rendered in isolated Playwright contexts with blocked downloads, bounded navigation, private-network denial, timeouts, and output sanitization. Service-role credentials remain server-only. Telegram callbacks and Gmail webhooks are authenticated and replay-protected.
