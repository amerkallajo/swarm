# Pilot validation, audit, scoring, and drafts

This package advances an ignored reviewed discovery cohort through the smallest local pilot path.
It has no provider integration and cannot send messages.

```bash
pnpm pilot:validate
pnpm pilot:audit -- --manual .var/pilot/audit/import/reviewed-audits.json
pnpm pilot:score
pnpm pilot:draft
pnpm pilot:report
```

`pilot:validate` verifies the selected discovery manifest and hashes before idempotently inserting
businesses, websites, public business contact routes, and evidence into local PGlite state under
`.var/pilot/`. `pilot:audit` accepts at most ten reviewed businesses and requires an observed fact,
HTTPS evidence URL, business impact, recommendation, confidence, and timestamp for every finding.

Scores use the documented 100-point weights and database evidence references. Unknown response
likelihood is scored zero. Drafts are short, localized, and stored locally; no approval or contact
attempt is created. The final report combines the integrity-checked discovery counts, provenance,
timestamps, hashes, and sufficiency decision with the current pilot funnel and top five.
