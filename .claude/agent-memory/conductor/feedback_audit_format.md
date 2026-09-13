---
name: Conductor audits return ranked findings + dispatch order, never code
description: On "conductor audit" requests, return a capped ranked findings list with file:line and a follow-up implementation order; do not write implementation code.
type: feedback
---

For a conductor audit: return a **ranked** findings list (respect the user's cap, e.g.
max 8), each with `file:line`, the concrete invariant violated, the money/stock
consequence, and the fix. Then give a short recommended implementation order for a
follow-up agent. Rank by blast radius on the books, not by code elegance.

The user also asks for the 2-3 highest-leverage engineering improvements and explicitly
frames them as "not feature bloat" — so propose *enforcement and verification*
mechanisms (make the invariant impossible to violate, or make the violation visible),
not new screens or new business features.

**Why:** The user triages and dispatches fixes to separate specialist sessions, often
in parallel terminals. A conductor that starts editing produces a diff they did not
ask to review, and it collides with whatever session actually owns those files.

**How to apply:** Read code and report. File paths are mandatory — a finding without
`file:line` is not actionable for the follow-up agent. Keep the implementation order
dependency-aware (shared helper/type changes first, then the callers), and call out
which items can run in parallel because their file zones do not overlap.
