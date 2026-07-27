# Preview Generation

## Entry criteria

A real preview requires a clearly interested reply, verified business identity, approval to create, an approved brief, and an asset-rights plan. Building, publishing, and sending are separate approvals.

## Workflow

1. Freeze an evidence bundle: brand facts, services, location, public content, audit, reply context and source URLs.
2. Produce a one-page concept brief describing audience, primary conversion, hero proposition, trust signals, CTA, mobile behavior and excluded assumptions.
3. Classify every asset as business-owned with permission, permissively licensed with attribution, public factual text used minimally, or generated/placeholder. Never copy licensed photography or testimonials without permission.
4. Select a reviewed industry template and generate a focused concept rather than a production site.
5. Build on an isolated branch/path with no credentials or third-party tracking.
6. Run lint/typecheck/tests, responsive Playwright screenshots, Lighthouse budgets, axe checks, link validation and factual-claim review.
7. Human-review the exact commit and screenshots.
8. After publish approval, deploy an immutable commit to an isolated Netlify preview; verify HTTPS, `noindex`, concept banner, expiry, and contact-form disabled or clearly non-production.
9. Store commit SHA, deployment ID/URL, QA results, approval and expiration.
10. After send approval, share the preview and record the Gmail thread.
11. Expire or remove previews after the retention window or on request.

## Required concept label

“Unofficial redesign concept prepared for discussion. Not the business’s live website.” The preview must not impersonate ownership or accept real bookings/payments.

## Quality budgets

Mobile-first at 360px; no critical axe violations; no broken primary links; HTTPS and no mixed content; Lighthouse targets set per template and recorded rather than guaranteed; optimized local/placeholders; clear CTA and trust hierarchy; no unsupported claims.

## Loop controls

One active deployment per approved commit, bounded build retries, per-lead deployment cap, immutable deploy records, and manual approval for regeneration after failed review.
