# Security

## Secret management

No credentials in code, docs, issue bodies, screenshots, client bundles or logs. `.env.example` contains names only; local `.env*` files are ignored. Use separate development/production credentials, vendor secret stores, least privilege and rotation. Tokens posted in chat are considered exposed and should be rotated.

## Outbound fail-closed controls

`OUTREACH_ENABLED=false`, `PREVIEW_PUBLISH_ENABLED=false`, workspace pause, emergency shutdown, valid approval, eligible status, non-expired evidence, suppression check, budget check and idempotency are all required. Missing/failed checks deny action. Database constraints and application policy both enforce critical gates.

## Application security

- Dashboard authentication with MFA-capable provider and role-based authorization.
- RLS for workspace data; service role only in worker/server runtime.
- CSRF protection, secure cookies, strict CORS/CSP, input schemas and output encoding.
- SSRF defense: allow HTTP/S only, resolve and block loopback/private/link-local/cloud metadata ranges before and after redirects, cap body size/time/redirects.
- Browser sandbox: isolated contexts, blocked downloads, no saved credentials, bounded pages/time, untrusted-content handling.
- Webhooks: signatures/secret tokens, replay windows and idempotency.
- Dependencies pinned with lockfile, Dependabot, provenance review and minimal scripts.

## Operations

Structured logs redact credentials, authorization headers, cookies, email bodies and PII. Alert on auth failures, policy denials, unexpected side effects, cost spikes and dead-letter jobs. Backups are encrypted and restoration is tested. Production migrations require review and rollback plans.

## Supply-chain and repository controls

The SWARM repository is public under Amer's explicit approval. No credentials, private lead data,
personal data, provider payloads or unpublished prospect artifacts may be committed. Branch
protection, pull-request checks, Gitleaks, dependency review, code scanning, push protection,
artifact retention limits and redacted Actions output remain required. Preview repositories/assets
inherit the same rules.

## Limits

Per-vendor daily/monthly budgets, queue concurrency, actor run size, audit pages, browser time, LLM tokens, emails/day/domain, deploys/lead/day and retry attempts. Crossing a hard limit pauses the relevant subsystem and alerts Amer.

## Incident response

Emergency shutdown revokes scheduling and new side effects; reconcile in-flight sends/deploys; rotate affected secrets; preserve redacted evidence; assess suppression/PII impact; notify as legally required; document root cause and prevention before resuming.
