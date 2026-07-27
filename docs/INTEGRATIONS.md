# Integrations

## Verified current access

| Integration | State | Evidence | Initialization action |
|---|---|---|---|
| GitHub | Ready | CLI authenticated as `amerkallajo`; repo/workflow scopes | Use a new private SWARM repository |
| Netlify | Account ready, SWARM unlinked | CLI authenticated; three unrelated sites listed | Create/link only in preview phase after approval |
| Supabase | CLI access only | One unrelated active project is visible | Create a separate SWARM project after approval |
| Telegram | Not safely initialized | Existing Hermes env credential resolves to `@ccclowdbot`, not proven dedicated; no candidate chat | Rotate supplied token, store as SWARM runtime secret, start bot, capture allowed chat/user IDs |
| Gmail | Missing | No `gws` or Himalaya CLI detected; no SWARM OAuth client verified | Configure Google Cloud OAuth and least-scope Gmail API |
| Apify | Credential not configured | CLI absent and `APIFY_API_TOKEN` not in process environment | Rotate the chat-posted token, then store securely as `APIFY_API_TOKEN` |
| Secret scanner | Missing locally | No gitleaks/trufflehog command | Add Gitleaks CI and pre-commit hook |
| Docker | Ready | Docker command available | Use for reproducible local dependencies if needed |

## Integration choices

### GitHub
Private repository, issues, branch protection, Actions, Dependabot and secret scanning. No customer personal data in issues or logs.

### Supabase
Use a new project for Postgres, Auth and Storage. Service role is worker-only. Dashboard users use Auth plus RLS. Keep raw scrape artifacts in a private bucket with retention rules.

### Apify
Use only actors whose data sources and terms fit the target jurisdiction. Start with tiny bounded test runs and a per-run spend cap. Store actor/run/dataset IDs and source URLs.

### Gmail
Use Gmail API OAuth, not SMTP passwords. Start in draft-only mode; sending requires explicit approval. Scopes should begin with read metadata/drafts and add send only at the approved production gate. Persist provider IDs, not access tokens.

### Telegram
Use webhook in production or bounded long polling during development. Authorize exact Telegram user/chat IDs, sign callback payloads, expire approvals, and require typed confirmation for material actions. Telegram is a control surface, not the canonical database.

### Netlify
Create isolated preview sites. Concept pages must be `noindex`, clearly labeled, access-controlled or unlisted where practical, and automatically expire. Deploy only immutable reviewed commits.

## Deferred services

Email verification, enrichment, Sentry, managed queues and paid CRM are deferred until measured need. Prefer direct verification, Supabase, structured logs and the custom dashboard first.
