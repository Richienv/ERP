# Typecheck Baseline (Ratchet)

This file holds the **maximum number of TypeScript errors** that CI will tolerate.
CI reads the number from the marker line below — keep the line format exactly as-is.

```
TYPECHECK_BASELINE=241
```

- **Last verified:** 2026-07-27 (`npx tsc --noEmit 2>&1 | grep -c "error TS"` → `241`)
- **Finance-related files:** ~108 of those 241 errors.

## Why this exists

`next.config.ts` sets `typescript.ignoreBuildErrors: true`, so **type errors currently ship
to production** — `next build` never fails on them. Until that flag can be removed, this
baseline is the only thing standing between the repo and unbounded type-error growth.

## The ratchet policy

The CI job `.github/workflows/ci.yml` → step **"Typecheck ratchet"** runs `tsc --noEmit`,
counts lines matching `error TS`, and compares against the number above:

| Condition | CI result |
|---|---|
| current **>** baseline | ❌ **FAIL** — you introduced new type errors, fix them |
| current **==** baseline | ✅ pass |
| current **<** baseline | ✅ pass, with a reminder to lower the baseline |

This is deliberately a **ratchet, not a gate**. It does not ask anyone to fix the existing
241 errors in one go; it only guarantees the number never goes up.

## How to update the baseline

When you fix type errors, **lower the number** so the progress is locked in:

```bash
npm run typecheck 2>&1 | grep -c "error TS"   # get the new count
```

Then edit the `TYPECHECK_BASELINE=` line above to that count and commit it in the same PR.

Rules:

1. **Only ever lower it.** Raising the baseline requires an explicit, justified decision by
   the reviewer — it means new untyped code was knowingly merged.
2. Lower it **in the same PR** that fixes the errors, otherwise the next PR silently
   reclaims the slack.
3. The end goal is `TYPECHECK_BASELINE=0`, at which point
   `typescript.ignoreBuildErrors` should be removed from `next.config.ts` and the ratchet
   replaced by a hard `npm run typecheck` gate.

## Local usage

```bash
npm run typecheck                              # full type check
npm run typecheck 2>&1 | grep "error TS" | cut -d'(' -f1 | sort | uniq -c | sort -rn
                                               # errors grouped by file (worst first)
```
