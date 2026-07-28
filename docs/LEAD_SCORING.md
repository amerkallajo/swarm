# Lead Scoring

## Principles

Scoring ranks eligible leads; it never overrides exclusion, consent, legal, or approval rules. Every component must cite observed evidence and timestamp. Unknown values score neutrally/low and reduce confidence; they are never invented.

## Pilot score (0–100)

| Dimension | Weight | Required evidence |
| --- | ---: | --- |
| Active business | 20 | current opened source proving active operation |
| Website weakness and opportunity | 25 | timestamped audit findings tied to the business website |
| Commercial fit | 20 | observed service/category and conversion-path evidence, without invented revenue or ability to pay |
| Contactability | 15 | verified public business route with provenance |
| Personalization opportunity | 10 | specific current services, portfolio, or other opened-source facts |
| Response likelihood | 10 | evidence-based channel, language, and local fit without unsupported inference |

Weights sum to 100. Every component stores its points, evidence reference, observation timestamp, and
confidence. Unknown facts score low or remain unknown; they are never guessed.

## Risk penalty (0 to −40)

Penalties include identity ambiguity, stale/contradictory data, questionable source terms, generic/free-mail contact, low commercial fit, sensitive profession, recent ownership change, inaccessible site that cannot be verified, or reputation/compliance risk. Permanent closure, fake identity, opt-out, blacklist, sanctions/prohibited category, or inability to establish a lawful outreach path are hard exclusions rather than penalties.

## Gates

A lead is `QUALIFIED` only when:

- final score is at least 65;
- business identity, location, relevant service, active operation, website status, and public
  business route are verified;
- every score component cites evidence;
- no hard exclusion or suppression exists.

Suggested tiers: 80–100 priority review, 65–79 qualified, 50–64 research further, below 50 reject. Thresholds must be calibrated on outcomes and never silently changed.

## Explainability record

Store score version, raw observations, component values, weights, penalties, missing evidence, confidence, hard-gate results and a concise selection explanation. Re-score when evidence expires or scoring changes; retain all historical versions.

## Validation

Before production, label a blinded sample manually, measure agreement, inspect false positives by industry/jurisdiction, and backtest thresholds. Outcome learning may recommend weight changes but cannot deploy them without approval and versioning.
