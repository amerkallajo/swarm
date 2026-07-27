# Config

Shared configuration primitives. The first invariant is fail-closed parsing for the two outbound
environment flags; both default to disabled, and only the exact string `true` can enable a flag.
This package performs no environment reads or side effects on import.
