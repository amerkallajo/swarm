# Database Schema

PostgreSQL is the canonical source of truth. UUID primary keys, `timestamptz`, immutable event records, soft deletion where legally required, and tenant-ready `workspace_id` columns are standard.

## Core tables

- `workspaces`: settings, timezone, pause state, budgets and policy version.
- `users`: operator identity and role (`owner`, `approver`, `viewer`, `service`).
- `businesses`: canonical name, legal/trading identity, industry, location, activity state and dedupe fingerprint.
- `business_sources`: source provider, source URL/ID, observed fields, retrieved time, terms metadata and content hash.
- `contacts`: person/role, channel, normalized address, provenance, confidence, verification state and sensitivity flags.
- `websites`: canonical URL, domain, ownership confidence, first/last observed, HTTPS/DNS status.
- `website_snapshots`: fetch metadata, headers, content hash, screenshot/artifact references and observed timestamp.
- `audit_runs`: tool versions, start/end, status, device profile, confidence and cost.
- `audit_findings`: category, severity, measured value, expected threshold, evidence artifact/URL and factual narrative.
- `lead_scores`: model version, component JSON, positive score, penalty, final score, confidence, explanation and threshold decision.
- `leads`: business, current status, owner, priority, qualification time, next action and row version.
- `lead_status_events`: previous/new status, command, actor type/id, reason, evidence references, correlation ID and timestamp.
- `approvals`: action type, subject, request payload hash, requester, approver, decision, comment, expiry and decided time.
- `message_drafts`: lead/contact/channel, template version, cited evidence IDs, subject/body, policy result and approval ID.
- `send_intents`: idempotency key, draft, recipient hash, state, attempt count, provider IDs, reconciliation state and timestamps.
- `email_threads`: Gmail thread ID, lead/contact, last message time, consent/suppression state.
- `email_messages`: provider message ID, direction, headers subset, redacted body/artifact reference, classification and received/sent time.
- `follow_up_plans`: due time, maximum count, sent count, approval requirement and cancellation reason.
- `preview_projects`: lead, brief version, status, concept label, asset policy, repository path and approval IDs.
- `preview_assets`: source URL, license/permission class, content hash, local artifact and attribution.
- `deployments`: provider/site/deploy IDs, commit SHA, URL, state, noindex verification, expiry and approval ID.
- `suppression_entries`: normalized channel value hash, scope, reason, source, effective time and optional expiry.
- `policy_decisions`: policy version, action, inputs hash, outcome, rules fired and timestamp.
- `jobs`: type, payload, state, priority, attempts, run-after, lease owner/expiry, idempotency key and last error.
- `agent_decisions`: agent/model/prompt version, bounded inputs, output, confidence, citations and human override.
- `cost_events`: vendor, operation, units, estimated/actual cost, lead/job/correlation IDs.
- `system_events`: health, errors, pause/resume, configuration changes and emergency shutdowns.

## Critical constraints

- Unique active contact: `(workspace_id, channel, normalized_value_hash)`.
- Unique side effect: `send_intents.idempotency_key`, `deployments(provider, provider_deploy_id)`, and `jobs.idempotency_key`.
- A database trigger rejects outbound send intents if workspace is paused, recipient is suppressed, approval is absent/expired, or lead status is not eligible.
- Status changes occur only through a security-definer transition function that writes `lead_status_events` atomically.
- `DO_NOT_CONTACT` is irreversible except by owner action with a recorded legal reason; it never re-enables an opted-out address.
- Evidence rows include observation time; stale evidence cannot support outreach after the configured TTL.

## Indexes

Index current lead status/next action, jobs state/run-after, normalized domains/phones/emails, source IDs, Gmail thread/message IDs, approval subject/state/expiry, and all correlation IDs. Use partial indexes for runnable jobs and unsuppressed contacts.

## Security and retention

RLS isolates workspaces. PII columns are minimized; high-risk raw artifacts are encrypted/private and expire. Audit events are append-only for application roles. Deletion requests create tombstones and suppression hashes so deleted contacts are not rediscovered and contacted again.
