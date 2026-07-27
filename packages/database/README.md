# Database

Canonical forward-only PostgreSQL/Supabase schema for the thin SWARM pilot data model.

`migrations/0001_pilot_data_model.sql` creates only the 11 pilot tables. Application code supplies
UUIDs and timestamps. The schema retains worldwide source/location/language provenance, constrains
evidence-backed scores, binds approvals to exact immutable draft artifacts, and accepts only
approved, unsuppressed contact intents. It enables plus forces RLS without creating browser/public
policies.

Businesses, websites, contacts, lead evidence, audit findings, lead scores, outreach drafts,
suppressions, and activity events are append-only records. Business source and normalized identity,
and website URL and normalized URL/domain identity, cannot be updated or deleted; corrected
discovery facts require a new artifact. Approvals are immutable requests with a single
PENDING-to-terminal decision. Contact attempts preserve immutable original intent, allow only the
documented monotonic status transitions and one-time provider identifiers, and deny deletion.

Tests execute the migration in a fresh in-memory PostgreSQL database using
`@electric-sql/pglite` 0.5.4. They require no Docker, PostgreSQL service, Supabase project,
credentials, or runtime network access.

```bash
npx --yes pnpm@11.9.0 --filter @swarm/database lint
npx --yes pnpm@11.9.0 --filter @swarm/database typecheck
npx --yes pnpm@11.9.0 --filter @swarm/database test
npx --yes pnpm@11.9.0 --filter @swarm/database build
```

This package does not contain an ORM, repository layer, API, queue, multi-tenant schema, provider
integration, public policy, real prospect data, or outbound behavior.
