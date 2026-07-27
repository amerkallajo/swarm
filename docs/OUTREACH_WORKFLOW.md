# Outreach Workflow

## Precondition

No outbound communication occurs during initialization. Production starts in draft-only shadow mode.

## Workflow

1. Validate identity, activity, website ownership, contact provenance and jurisdiction.
2. Confirm the recipient is not suppressed and the lead has current evidence.
3. Generate a concise draft whose factual claims cite audit/source evidence.
4. Run deterministic policy checks: commercial identity disclosed, no guaranteed results, no fake urgency, clear no-obligation offer, opt-out path, follow-up limit and sensitive-category rules.
5. Present the lead, evidence, score and exact message for approval.
6. Persist approval with payload hash and expiry; editing the message invalidates approval.
7. At send time, re-check pause state, suppression, eligibility, approval, daily/domain caps and idempotency.
8. Send through Gmail API and persist provider message/thread IDs. Reconcile uncertain responses before retrying.
9. Ingest replies, preserve thread context and classify `interested`, `question`, `not_now`, `not_interested`, `opt_out`, `wrong_contact`, or `uncertain`.
10. Opt-out immediately suppresses the address and business scope. Uncertain or contractual/pricing content routes to Amer.

## Initial message requirements

Identify the agency honestly; mention one or two verifiable observations; explain the possible business/UX improvement without claiming guaranteed revenue; offer a free concept not yet built; state no contract, commitment, upfront payment, or purchase obligation; allow a simple decline.

## Follow-ups

Default maximum is one follow-up, no sooner than the approved market interval, only when no reply or bounce exists. More than one follow-up requires separate approval. Any negative signal cancels pending jobs.

## Approval gates

Human approval is mandatory for first real email, each new market/industry, sensitive professions, preview creation/publication/send, pricing, discounts, contractual terms, timeline claims, second follow-up, and material strategy change.

## Anti-duplication

Canonicalize business, domain and contact; lock the lead during send; use an idempotency key derived from workspace/contact/campaign/sequence; maintain provider reconciliation; and query message history before every send. A crash after provider acceptance must reconcile, not retry blindly.

## Experimentation

Experiments begin only after baseline safety. Randomize message variants at the lead level, cap sample sizes, store versions, and optimize positive-reply and complaint-adjusted conversion—not open-rate vanity metrics.
