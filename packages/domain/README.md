# Domain

Pure, deterministic lead-state decisions for the SWARM foundation.

The package exports the canonical lead statuses, finite commands, actors, terminal-state list,
immutable transition introspection, related TypeScript types, and `decideLeadTransition`. The
decision function accepts untrusted values, never performs side effects, and returns a frozen
allow/deny result with a stable reason code.

This package does not implement persistence, policy budgets, approval records, integrations,
outreach, previews, scheduling, or any other external side effect.
