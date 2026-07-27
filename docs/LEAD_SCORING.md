# Lead Scoring

## Principles

Scoring ranks eligible leads; it never overrides exclusion, consent, legal, or approval rules. Every component must cite observed evidence and timestamp. Unknown values score neutrally/low and reduce confidence; they are never invented.

## Positive score (0–100)

| Dimension | Weight | Evidence examples |
|---|---:|---|
| Business activity | 12 | recent reviews/posts, current hours, active registry/listing |
| Website quality weakness | 8 | broken flows, rendering errors, poor information architecture |
| Outdated appearance/age signals | 5 | obsolete stack/copyright, stale content, dated patterns |
| Mobile usability | 6 | viewport, overflow, tap targets, mobile Lighthouse/Playwright |
| Performance | 5 | LCP, INP/TBT proxy, CLS, transfer size |
| SEO | 5 | titles, canonicals, indexing, structured data, headings |
| Security/HTTPS | 3 | TLS, redirects, mixed content, security headers |
| Contactability | 10 | verified business email/phone, decision-maker route, provenance |
| Review activity | 7 | recency, volume trend, owner responses, platform confidence |
| Commercial value | 12 | service value, conversion dependence, local demand, deal fit |
| Estimated ability to pay | 10 | established operation, locations/team/services; never protected traits |
| Redesign need likelihood | 7 | combined measurable pain and business opportunity |
| Response likelihood | 5 | reachable role, active channel, language/local fit, prior engagement |
| Personalization data | 5 | specific services, differentiators, recent factual activity |

Weights sum to 100. Each component receives 0–1 and records `value × weight`, confidence and evidence IDs.

## Risk penalty (0 to −40)

Penalties include identity ambiguity, stale/contradictory data, questionable source terms, generic/free-mail contact, low commercial fit, sensitive profession, recent ownership change, inaccessible site that cannot be verified, or reputation/compliance risk. Permanent closure, fake identity, opt-out, blacklist, sanctions/prohibited category, or inability to establish a lawful outreach path are hard exclusions rather than penalties.

## Gates

A lead is `QUALIFIED` only when:
- final score is at least 65;
- overall evidence confidence is at least 0.70;
- activity is at least 6/12 and contactability at least 6/10;
- business identity and location are resolved;
- at least two independent evidence sources exist, including one recent activity signal;
- no hard exclusion or suppression exists.

Suggested tiers: 80–100 priority review, 65–79 qualified, 50–64 research further, below 50 reject. Thresholds must be calibrated on outcomes and never silently changed.

## Explainability record

Store score version, raw observations, component values, weights, penalties, missing evidence, confidence, hard-gate results and a concise selection explanation. Re-score when evidence expires or scoring changes; retain all historical versions.

## Validation

Before production, label a blinded sample manually, measure agreement, inspect false positives by industry/jurisdiction, and backtest thresholds. Outcome learning may recommend weight changes but cannot deploy them without approval and versioning.
