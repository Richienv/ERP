---
name: /workspace is shared with parallel agents — commit via your own worktree
description: Another session can switch the branch under you mid-task; how to commit safely without disturbing them
type: feedback
---

Do not assume `/workspace` stays on the branch you created. During the
2026-09-13 hidden-module audit another session checked out its own branch in the
same worktree while edits were in progress. Verify with `git status -sb` before
committing, and if HEAD has moved, commit through a private worktree
(`git worktree add /tmp/<name> <your-branch>`, copy only your files, commit,
push, `git worktree remove`) instead of switching HEAD back.

**Why:** switching HEAD or staging broadly in the shared checkout can capture or
destroy another session's in-progress work — the repo guidance in CLAUDE.md calls
this out, and it happens in practice.

**How to apply:** before committing, diff your files against both your branch and
current HEAD to confirm the changes are only yours. Stage files explicitly (never
`git add .`). Avoid `git stash` in the shared checkout — a pop can resurrect
another session's state. Clean your edits out of the shared tree only after
confirming they match what you already pushed.
