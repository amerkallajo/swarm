# @swarm/discovery

A bounded, read-only discovery adapter for one pilot cohort: premium automotive detailing and
ceramic-coating studios in Riyadh and Jeddah. Discovery never authorizes outreach.

## Workflow

The default command uses only the committed synthetic fixture:

```bash
pnpm pilot:discover
pnpm pilot:report
```

The one live mode has no configurable endpoint, query, mirror, output path, or candidate limit:

```bash
pnpm pilot:discover -- --live
```

If OSM is insufficient, put a human-reviewed JSON document under the ignored
`.var/pilot/discovery/import/` directory:

```bash
pnpm pilot:discover -- --manual .var/pilot/discovery/import/candidates.json
pnpm pilot:report
```

The manual schema is demonstrated by `fixtures/manual.synthetic.json`. Every accepted fact requires
an opened HTTPS source for identity, activity, independence, website status, public business contact,
and any claimed opportunity. A plausible opportunity also requires the concise observed fact.
Unknown, closed, chain, personal-contact, malformed, duplicate, and over-cap records receive
fail-closed exclusion reasons.

## Concrete safety boundary

- Exact HTTPS endpoint: `https://overpass-api.de/api/interpreter`; POST only.
- Identifying User-Agent, 30-second hard timeout, 10 MiB streaming limit, and no redirect following.
- DNS results are checked before connection; private, loopback, link-local, carrier-NAT, multicast,
  metadata, and other non-public destinations are rejected.
- The parser accepts raw UTF-8 JSON only, validates the bounded Overpass shape, retains a finite tag
  set, preserves Arabic Unicode, and caps selected candidates at 30.
- Generic car wash/repair tags are recall seeds, not premium evidence. Eligibility requires explicit
  premium-service evidence, automotive context, and a public business route.
- Brand/operator/network signals are held for independence review. Unknown facts remain unknown.
- Every raw element has one disposition and aggregate counts must reconcile.
- Raw, normalized, report, and manifest artifacts publish as one directory. Reports verify all
  manifest hashes before displaying aggregates.
- Real artifacts stay under ignored `.var/pilot/discovery/`; no real dataset is committed.

OSM website tags are pointers, not proof of ownership or active operation. A missing website tag is
not proof that no website exists. For that reason OSM alone always returns
`REVIEWED_IMPORT_REQUIRED`; the reviewed-import adapter applies the exact 15/10/8 feasibility rules.

## 2026-07-28 live result

The bounded run returned 736 raw elements and parsed 644. Three passed the mechanical category
filter, two required chain/operator review, and one was selected. That record had no website pointer
and one public business route. OSM therefore failed all next-stage criteria. This is evidence that
OSM is insufficient for this cohort, not that the market is insufficient.

Raw capture SHA-256:
`9719421fc6608fb62fe95c6b9e510aca0a0a6dd5ad41c9408f1f19137103d15e`.
The capture remains ignored locally.

## Verification

```bash
pnpm --filter @swarm/discovery lint
pnpm --filter @swarm/discovery typecheck
pnpm --filter @swarm/discovery test
pnpm --filter @swarm/discovery build
```
