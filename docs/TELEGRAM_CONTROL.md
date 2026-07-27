# Telegram Control

Telegram is an authenticated control and notification surface. Supabase remains canonical.

## Commands

- `/start` — identify the bot and show authorization state.
- `/help` — available commands for the caller’s role.
- `/status` — pause state, queue depth, daily spend/sends and health.
- `/pause [reason]` — stop new discovery, audits, drafts, sends and deploys; running side effects finish/reconcile safely.
- `/resume` — owner-only, shows blockers and requires confirmation.
- `/lead <id>` — identity, score, evidence, status, suppression and next action.
- `/approve <approval_id>` — approve the exact payload hash before expiry.
- `/reject <approval_id> [reason]` — reject and record reason.
- `/blacklist <lead_id> [reason]` — create suppression and cancel pending actions.
- `/postpone <lead_id> <date> [reason]` — set `FOLLOW_UP_LATER` without outreach.
- `/approvals` — pending approvals.
- `/errors` — recent redacted incidents.
- `/costs [period]` — usage and budget headroom.
- `/shutdown` — emergency owner-only two-step confirmation.

Inline buttons may approve/reject only short-lived, payload-hashed requests. Callback data contains opaque IDs, never PII or message bodies.

## Alerts

Daily operational summary; newly qualified lead; approval requests; reply notification; preview ready; deployment expiry; cost threshold; dead-letter job; integration failure; unexpected send/deploy reconciliation; pause/shutdown changes.

## Security

Allowlist exact user and chat IDs. Reject groups unless explicitly configured. Validate Telegram secret token/webhook, prevent update replay, rate-limit commands, expire approvals, and record every command/result. Sensitive details are linked to the dashboard rather than placed in messages.

## Initialization finding

The currently configured Hermes Telegram credential resolves to `@ccclowdbot` and returned no candidate chat. It is not treated as the dedicated SWARM bot. The bot token supplied in chat should be rotated because chat is not a secret store; then set `TELEGRAM_BOT_TOKEN` in the SWARM runtime secret store. Amer must start the bot once so SWARM can verify and allowlist the intended chat/user IDs. Until then, the initialization report remains local.
