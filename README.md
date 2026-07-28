# SWARM — Autonomous Web Design Outreach System

SWARM is a consent-aware, evidence-driven acquisition system for a web design agency. It discovers and validates businesses, audits websites, ranks opportunities, drafts personalized outreach, coordinates human approvals, and builds concept previews only after demonstrated interest.

## Fast-track pilot

The immediate objective is a thin, controlled vertical slice: discover about 30 candidates, validate
15, audit 10, present five, draft for three, and contact exactly one real prospect only after Amer
approves the exact business, recipient, message, and channel. Work that does not directly advance
that objective is deferred unless it prevents a serious security, compliance, credential,
duplication, or data-loss risk.

The broader read-only strategy is opportunity-led worldwide, and its first bounded source test is
independent premium automotive detailing and ceramic-coating studios in Riyadh and Jeddah.
Arabic-first and bilingual evidence is preserved. The cohort is a hypothesis, not outreach
authorization, and the broader architecture remains post-validation direction. See
[`docs/FAST_TRACK_PILOT.md`](docs/FAST_TRACK_PILOT.md) and
[GitHub Issues #26](https://github.com/amerkallajo/swarm/issues/26) and
[#31](https://github.com/amerkallajo/swarm/issues/31).

## Current state

Initialization, the pnpm/Turborepo foundation, protected CI/security workflows, the immutable
fail-closed lead transition matrix, isolated pilot database package, and bounded fixture-first
OpenStreetMap discovery package are implemented. The dashboard and worker remain inert. Real
discovery artifacts stay in ignored local storage; no business has been validated, audited,
contacted, or previewed, and no Supabase project, Telegram, Gmail, Apify, or outbound integration is
active.

Verified during initialization:

- Local workspace was empty and was not an existing Git repository.
- No older SWARM repository or code was found in the connected GitHub account.
- GitHub CLI is authenticated as `amerkallajo` with repository/workflow access.
- Netlify CLI is authenticated; three unrelated sites exist, and SWARM is not linked.
- Supabase CLI can access one unrelated project; SWARM has no project.
- No Gmail integration or Apify CLI/environment credential is configured for SWARM.
- Any integration credential previously exposed in chat is compromised and must not be used.

Potentially reusable work exists in private repositories: website audit/checklist patterns from `econicmedia`, schema validation and fail-closed storage patterns from `cheflight`, and Netlify configuration patterns from `tatiana-garder-steuerberatung`. Reuse requires extraction and review; no code was copied during initialization.

## Safety posture

- `OUTREACH_ENABLED=false` and `PREVIEW_PUBLISH_ENABLED=false` are hard defaults.
- No email may be sent without a durable approval record and idempotency key.
- Opt-outs and blacklists override every workflow.
- Sensitive professions, new markets, pricing, timelines, previews, and strategy changes require human approval.
- The system never claims observations it cannot cite.
- The GitHub repository is public under Amer's explicit approval so public-repository CodeQL,
  dependency review, secret scanning, and protected-branch controls remain available.
- Any credential exposed in chat, logs, screenshots, issues, or commits must be rotated before use.

## Proposed stack

TypeScript monorepo (pnpm + Turborepo), Next.js operator dashboard, Node.js worker, Supabase Postgres/Auth/Storage, PostgreSQL-backed jobs, Apify discovery adapters, Playwright/Lighthouse/axe website audits, Gmail API with OAuth, Telegram Bot API, and Netlify preview deploys.

Start with a modular monolith and one worker. Split services only when load or operational isolation proves necessary.

## Documentation

See `docs/` for the fast-track pilot, long-term architecture, integrations, schema, scoring, outreach,
previews, Telegram control, security, compliance, costs, implementation phases, and decisions. The
original long-term tasks remain in `BACKLOG.md`; Issue #26 is the pilot execution epic.

## Repository layout (target)

```text
apps/dashboard
apps/worker
packages/config
packages/database
packages/domain
packages/discovery
packages/validation
packages/audit
packages/scoring
packages/outreach
packages/gmail
packages/telegram
packages/previews
packages/compliance
packages/observability
supabase/migrations
templates/previews
docs
```

## Implemented layout

```text
apps/dashboard     # deterministic dashboard placeholder
apps/worker        # inert worker placeholder
packages/config    # fail-closed outbound flag parsing
packages/database  # tested forward-only PostgreSQL pilot schema and typed vocabularies
packages/discovery # bounded fixture/live OSM discovery, normalization, evidence, and reports
packages/domain    # immutable lead states, commands, actors, and transition decisions
packages/pilot     # local validation, audit import, evidence-bound scoring, and unsent drafts
```

The larger target layout above remains the architectural direction; packages are added only in the
issue that implements them.

## Development

Use Node.js 24 or newer. This Windows host has an unusable Corepack shim, so invoke the repository's
pinned package manager explicitly:

```bash
npx --yes pnpm@11.9.0 install --frozen-lockfile
npx --yes pnpm@11.9.0 format:check
npx --yes pnpm@11.9.0 lint
npx --yes pnpm@11.9.0 typecheck
npx --yes pnpm@11.9.0 test
npx --yes pnpm@11.9.0 build
npx --yes pnpm@11.9.0 check
npx --yes pnpm@11.9.0 pilot:discover
npx --yes pnpm@11.9.0 pilot:validate
npx --yes pnpm@11.9.0 pilot:audit -- --manual .var/pilot/audit/import/reviewed-audits.json
npx --yes pnpm@11.9.0 pilot:score
npx --yes pnpm@11.9.0 pilot:draft
npx --yes pnpm@11.9.0 pilot:report
```

`check` runs formatting, lint, typechecking, tests, and builds. Never put credentials in this
repository. Copy `.env.example` to a local ignored file and use separate development/production
credentials. The checked-in outbound defaults remain disabled and budgets remain zero.
Real discovery, audit, score, and draft artifacts stay under the ignored `.var/pilot/` directory.

Repository CI and security checks are documented in
[`docs/BRANCH_PROTECTION.md`](docs/BRANCH_PROTECTION.md). Their presence does not authorize
scraping, outreach, publishing, deployment, or paid resources.
