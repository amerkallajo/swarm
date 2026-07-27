# SWARM — Autonomous Web Design Outreach System

SWARM is a consent-aware, evidence-driven acquisition system for a web design agency. It discovers and validates businesses, audits websites, ranks opportunities, drafts personalized outreach, coordinates human approvals, and builds concept previews only after demonstrated interest.

## Fast-track pilot

The immediate objective is a thin, controlled vertical slice: discover about 30 candidates, validate
15, audit 10, present five, draft for three, and contact exactly one real prospect only after Amer
approves the exact business, recipient, message, and channel. Work that does not directly advance
that objective is deferred unless it prevents a serious security, compliance, credential,
duplication, or data-loss risk.

The initial read-only discovery slice targets established painting, renovation, and
interior-finishing businesses in Germany, with German outreach drafts. The broader architecture is
preserved as post-validation direction. See
[`docs/FAST_TRACK_PILOT.md`](docs/FAST_TRACK_PILOT.md) and
[GitHub Issue #26](https://github.com/amerkallajo/swarm/issues/26).

## Current state

Initialization, the pnpm/Turborepo foundation, protected CI/security workflows, and the immutable
fail-closed lead transition matrix are implemented. The dashboard and worker remain inert. No pilot
business has been discovered, audited, contacted, or previewed; no Telegram, Gmail, Apify, database,
or outbound integration is active.

Verified during initialization:

- Local workspace was empty and was not an existing Git repository.
- No older SWARM repository or code was found in the connected GitHub account.
- GitHub CLI is authenticated as `amerkallajo` with repository/workflow access.
- Netlify CLI is authenticated; three unrelated sites exist, and SWARM is not linked.
- Supabase CLI can access one unrelated project; SWARM has no project.
- No Gmail integration or Apify CLI/environment credential is configured for SWARM.
- The existing Hermes Telegram credential belongs to `@ccclowdbot`, has no candidate chat, and is not assumed to be the dedicated SWARM bot.

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
packages/domain    # immutable lead states, commands, actors, and transition decisions
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
```

`check` runs formatting, lint, typechecking, tests, and builds. Never put credentials in this
repository. Copy `.env.example` to a local ignored file and use separate development/production
credentials. The checked-in outbound defaults remain disabled and budgets remain zero.

Repository CI and security checks are documented in
[`docs/BRANCH_PROTECTION.md`](docs/BRANCH_PROTECTION.md). Their presence does not authorize
scraping, outreach, publishing, deployment, or paid resources.
