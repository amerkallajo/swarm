# SWARM Fast-Track Pilot

## Directive

SWARM now prioritizes the smallest safe end-to-end workflow that can identify, qualify, audit, prepare outreach for, obtain approval for, and contact **one** strong real prospect. The long-term architecture remains valid reference material, but work that does not directly advance the first controlled prospect is deferred unless it prevents a serious security, compliance, credential, duplication, or data-loss risk.

Tracked by [GitHub Issue #26](https://github.com/amerkallajo/swarm/issues/26).

## Operating test

Before starting work, ask:

> Does this task directly help SWARM identify, qualify, prepare, approve, or contact the first strong prospect?

If not, defer it unless it is a necessary safety gate.

## Pilot boundary

### Initial market

- **First discovery slice:** Germany, then nearby German-speaking DACH markets only if the Germany cohort lacks sufficient quality. This keeps the first German outreach drafts and jurisdiction review bounded instead of treating “anywhere” as one legal market.
- **Languages supported for evidence review:** German, English, and Arabic.
- **Initial vertical:** established local painting, renovation, and interior-finishing businesses.
- **Business profile:** active owner-operated businesses or small-to-medium teams with clear commercial activity, a working public contact route, and plausible ability to purchase a professional website.
- **Expansion:** other countries, languages, and industries are post-validation unless read-only evidence shows the initial slice cannot produce the required cohort.

Country and language selection here authorizes **read-only research only**. Real outreach still requires Amer’s approval of the exact prospect, recipient, message, and channel, plus the applicable legal/compliance gate.

### Funnel limits

| Stage                         |              Maximum pilot target |
| ----------------------------- | --------------------------------: |
| Discovered candidates         |                  approximately 30 |
| Activity-validated businesses |                           best 15 |
| Fully audited websites        |                           best 10 |
| Leads presented to Amer       |        best 5 scoring at least 65 |
| Exact German drafts           |                            best 3 |
| Initial real contacts         | exactly 1 after explicit approval |

No mass scraping, bulk email, automatic multi-prospect contact, or automatic follow-up is allowed.

## Minimum vertical slice

### A. Bounded discovery

Use fixtures first. Add a bounded Apify or equivalent public-source adapter only when credentials and source terms are confirmed. For each candidate, retain:

- business name;
- website URL;
- public business email or suitable public contact route;
- public phone when relevant;
- city and region;
- business category;
- source URL and provider identifier when available;
- recent activity, review count, and review recency signals;
- collection timestamp.

Every fact has provenance and an observation timestamp. Unknown facts stay unknown. Publicly visible information is not automatically lawful or appropriate for outreach.

### B. Activity validation

Validate with current, mutually consistent evidence such as recent reviews, recent projects or social activity, current opening hours, active listings, working domain/website, and valid public business contact details. Reject or hold candidates with stale, contradictory, fabricated, or insufficient evidence.

### C. Concise website audit

Audit only what affects buyer confidence or enquiries:

- mobile usability;
- homepage clarity and design quality;
- loading performance;
- HTTPS and obvious technical defects;
- calls to action and contact accessibility;
- service presentation;
- trust signals, reviews, certifications, and portfolio/projects;
- SEO fundamentals;
- broken pages/interactions;
- clarity of the conversion path.

Each finding stores the observed problem, supporting evidence, business impact, recommended improvement, confidence, source, and observation time. Never invent a defect.

### D. Pilot qualification

The scoring model totals 100 points:

| Component                                   | Points |
| ------------------------------------------- | -----: |
| Active business                             |     20 |
| Website weakness and redesign opportunity   |     25 |
| Commercial fit and plausible ability to pay |     20 |
| Contactability                              |     15 |
| Personalization opportunities               |     10 |
| Likelihood of response                      |     10 |

Hard exclusions and suppression override the score. Only businesses scoring **65 or higher** may be presented. Each score must explain selection, observed website weaknesses, likely redesign value, activity evidence, commercial fit evidence, and available contact route. Protected traits and unsupported inferences are prohibited.

### E. Personalized German draft

The first message must be short, honest, and specific. It mentions one or two observed facts without insulting the current site or using generic praise. It may offer a free redesign concept and must say there is no contract, upfront payment, obligation, or commitment to purchase; pricing is discussed only if they like the concept. It includes a simple decline path and no fake urgency, guarantees, fake familiarity, or claim that an unbuilt concept already exists.

### F. Telegram approval shadow flow

Pilot commands are limited to:

- `/status`, `/pause`, `/resume`, `/leads`, `/lead <id>`;
- `/approve_lead <id>`, `/reject_lead <id>`;
- `/approve_draft <id>`, `/reject_draft <id>`;
- `/blacklist <id>`, `/costs`.

Only Amer’s explicitly allowlisted Telegram user and chat IDs may approve. Approval cards include business, website, location, activity evidence, audit summary, score, contact route, exact message, and estimated processing cost. Telegram is a control surface, not the source of truth. Fixture/mock output is used before dedicated credentials are configured.

### G. Gmail draft-only flow

Start with read/draft capability. Create the exact Gmail draft, then notify Amer. No send occurs until Amer approves the exact recipient, message, and channel. Store provider message/thread references after a confirmed send. An uncertain provider result stops retries and requires reconciliation. If Gmail OAuth is unavailable, provide the exact ready-to-send message for manual sending without blocking discovery or auditing.

## Pilot storage

Preferred storage is a new isolated SWARM Supabase development project. Keep the schema minimal:

- `businesses`, `contacts`, `websites`;
- `lead_evidence`, `audit_findings`, `lead_scores`;
- `outreach_drafts`, `approvals`, `contact_attempts`;
- `suppressions`, `activity_events`.

Until that project exists, an ignored local pilot database may be used, provided it is durable, prevents duplicate contact, retains provenance/timestamps, contains no committed lead data, and has an explicit migration path. Agent/chat memory is never the source of truth.

## Required safety gates

Before any real contact:

1. exact prospect and business identity are verified;
2. exact recipient and public contact route are verified;
3. source terms, market/jurisdiction, legal identity, and required disclosures are resolved;
4. suppression and prior-contact checks pass;
5. the exact payload hash has an unexpired approval from Amer;
6. outreach is enabled for this one intent, pause/shutdown are clear, and budget allows it;
7. an immutable intent and unique idempotency key exist;
8. provider uncertainty is reconciled before retry;
9. the attempt and provider references are recorded.

Credentials remain outside Git. Any credential ever posted in chat, logs, screenshots, issues, or commits is treated as exposed and rotated before use. Fixture data must not contain real personal data.

## Preview after interest only

A preview is not a prerequisite for first contact. If the contacted prospect expresses interest, create one high-impact unofficial homepage concept covering hero, services, trust, project gallery, calls to action, contact flow, and mobile design. Use licensed assets, add `noindex`, isolate the Netlify preview, and obtain separate approvals for creation, publication, and sending. Do not build a free production site.

## Deferred until market validation

- full CRM and complex multi-tenancy;
- distributed services, browser farms, and high-scale queues;
- advanced dead-letter and analytics infrastructure;
- automated follow-up campaigns or autonomous sending;
- multi-country, multi-language, or multi-industry expansion;
- automated pricing, contracts, negotiation, or full preview generation;
- machine-learning scoring and paid enrichment.

The existing architecture documents remain the long-term direction, not the pilot’s critical path.

## Execution order

1. Document and publish this strategy in a small protected PR.
2. Implement the minimal durable lead/evidence model.
3. Build fixture discovery and a bounded read-only adapter contract.
4. Add activity validation, concise audit, and pilot scoring.
5. Produce the bounded candidate dataset and present five evidence-backed leads.
6. Add Amer-only Telegram approval shadow controls.
7. Generate three exact German drafts.
8. Add Gmail draft-only mode or the manual-send fallback.
9. Ask Amer to approve one exact prospect, recipient, message, and channel.
10. Contact once, record/reconcile the attempt, and monitor the reply.
11. Build a preview only after documented interest and separate approval.

## Definition of success

The pilot is complete only when at least 30 businesses are discovered, 15 validated, 10 audited, five qualified leads are presented, three German drafts exist, Telegram approval is tested, one exact Gmail draft **or exact manual-send artifact** is approved, one real prospect is contacted after explicit approval, the attempt is recorded without duplication, and reply monitoring exists.

## Status reporting

Reports must list concrete counts and blockers rather than an inflated readiness percentage. Separate:

- engineering foundation readiness;
- lead discovery readiness;
- audit readiness;
- outreach draft readiness;
- real-contact readiness;
- preview readiness.

### Baseline at adoption — 2026-07-27

- **Engineering foundation:** TypeScript monorepo, protected CI/security workflows, immutable fail-closed lead state machine; no database or provider integration.
- **Lead discovery:** 0 pilot businesses; fixture adapter not yet implemented.
- **Audit:** no pilot audit pipeline or completed audits.
- **Outreach drafts:** 0 exact pilot drafts.
- **Real contact:** disabled; 0 prospects contacted.
- **Preview:** deferred; 0 real-business previews.
