# Review v0.3.x delta

## Goal
Split the large unreviewed delta between `main` (v0.2.3) and the current `release/v0.3.0-local-only` branch into smaller reviewable candidates that each fit under the native reviewer context budget.

## Context
- A review of the entire base-diff from `06f1559` (main/v0.3.0 tag) to `HEAD` failed with `lens_context_budget_exceeded`.
- The branch contains 10+ versioned commits covering validation, local-only cutover, reports, student editing, updater fixes, cache fixes, and the console-window fix.
- All versions have already been published as GitHub releases v0.3.0–v0.3.8.

## Options to evaluate
1. **Per-version reviews**: Run one review per released version (v0.3.0, v0.3.1, v0.3.2, v0.3.3, v0.3.4, v0.3.5, v0.3.6, v0.3.7, v0.3.8). Each is a committed range and likely fits the budget.
2. **Feature-group reviews**: Group related commits (e.g., updater fixes v0.3.3+v0.3.4, cache fixes v0.3.6+v0.3.7) into a few reviews.
3. **Reorganize history**: Use interactive rebase to squash/clean the branch into coherent feature commits before reviewing. Risky because some commits are already tagged/released.

## Constraints
- Do not rewrite published tags unless absolutely necessary and explicitly authorized.
- Preserve the existing release artifacts and their commit identities.
- Each review candidate must fit under the native context budget.

## Decision
Attempt per-version reviews, but abandon if the review lifecycle is unstable.

## Outcome
- Per-version reviews were attempted for v0.3.0 using an isolated Git worktree.
- The review state did not persist across `gentle_review status` calls (kept returning `fresh_target_ready`), so the approach was abandoned.
- The user explicitly decided to leave the historical v0.3.x delta unreviewed and proceed with testing the v0.3.8 Windows update.
- Temporary worktree was removed.
- Decision recorded in commit `ed91c4a`.

## Constraints
- Do not rewrite published tags or release history.
- Preserve the main development worktree state.
- Future changes will be reviewed normally under the enabled RDD workflow.
