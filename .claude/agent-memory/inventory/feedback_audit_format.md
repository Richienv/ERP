---
name: Audit requests want a short findings list, not implementations
description: When asked to audit inventory, return a capped findings list (title/kind/file:line/user impact/fix) and do not implement large features.
type: feedback
---

For audit requests, return a capped list of findings (user asked for MAX 8), each with:
title, kind, `file:line`, user impact, and the fix. Explicitly do NOT implement large
features during the audit.

**Why:** The user triages findings themselves and dispatches the fixes separately;
an agent that starts refactoring mid-audit produces a diff they did not ask to review.

**How to apply:** On "audit X for bugs/missing connections/slowness", read code and
report only. Rank findings by how much they break or slow the user's daily operating
loop (for inventory: restock/receiving), not by code elegance. Ask before writing
code beyond trivial notes/memory files.
