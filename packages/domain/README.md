# Domain

Pure, deterministic lead-state decisions for the SWARM foundation.

The package exports the canonical lead statuses, finite commands, actors, terminal-state list,
immutable transition introspection, related TypeScript types, and `decideLeadTransition`. The
decision function accepts untrusted values, never performs side effects, and returns a frozen
allow/deny result with a stable reason code.

Manual outreach recording is distinct from provider-confirmed sending. Preview delivery cannot move
from review to sent until a human approver records the exact `APPROVE_PREVIEW_SEND` transition and
the lead enters `PREVIEW_SEND_APPROVED`.

This package does not implement persistence, policy budgets, approval records, integrations,
outreach, previews, scheduling, or any other external side effect.
