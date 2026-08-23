# Product Phase 9 — Weekly Adaptive Planning

## Goal

Phase 9 closes the gap between per-plan Phase 8 feedback and a practical weekly planning workflow.

RealitySync can now collect the adopted experiment learnings that match plans across one Monday–Sunday week, let the user choose which learnings to reuse, simulate the combined result, and apply the selection only when the entire combination remains valid.

The feature is intentionally **not** an automatic weekly optimizer.

## Weekly preview

The Plan tab can expose **今週の現実適応プラン** when adopted experiments match pending plans in the selected current/future week.

The preview includes:

- matching adopted learnings grouped by date,
- the target plan,
- the explicit structured adjustment,
- historical baseline failure rate,
- experiment failure rate,
- experiment trial count,
- an evidence-review order.

No suggestion is selected by default.

## Evidence-review order

The review order is only a sorting aid.

It currently prefers:

1. more explicitly captured experiment trials,
2. then a larger observed reduction from historical failure rate,
3. then deterministic calendar/time ordering.

This order is **not**:

- a probability that the intervention is correct,
- causal evidence,
- an automatic winner,
- a command to apply the suggestion.

## Historical boundary

Only dates on or after the supplied `todayDateKey` are included in a weekly preview.

Phase 8 boundaries remain in force:

- recorded plans are never mutated,
- learning is never applied before the experiment adoption date,
- legacy adopted experiments without a trustworthy adoption date remain guidance-only,
- free-text experiment action descriptions are never parsed into schedule mutations.

## Multiple learnings on one plan

If more than one structured adopted experiment matches the same schedule, RealitySync shows the candidates but does not choose an ordering.

For weekly bulk application, the user must select at most one change for that target plan.

This is deliberately conservative because:

- shorten → shift may differ from shift → shorten,
- adding two buffers may duplicate time,
- later support for richer plan transformations could make order even more meaningful.

After applying one learning, the user may reopen the preview and evaluate another against the newly updated plan.

## Combination simulation

A selected weekly set is simulated before persistence.

The simulation reuses the same Phase 8 per-plan validation rules and checks the selections against the evolving temporary week state.

Examples that block the weekly set:

- two selected changes target the same plan,
- a selected buffer overlaps an existing or newly changed plan,
- a shifted plan creates a new overlap,
- an adjustment would cross the day boundary,
- a structured experiment can no longer be resolved,
- a selected item is guidance-only.

When a conflict occurs, RealitySync does **not** keep the already simulated earlier changes.

## Atomic application

Weekly application is all-or-nothing.

The simulation works on a cloned set of day data. Only after every selected adjustment succeeds does App replace the schedule store once.

Therefore:

- a failure on the third selected change does not persist the first two,
- current stored days remain unchanged during preview,
- closing the modal changes nothing,
- an explicit final Apply action is required.

## Deliberate limitation

The current bulk simulator is conservative and sequential.

A combination that could become valid only if another selected change first creates space may still be blocked. RealitySync prefers a false-negative suggestion over silently inventing an optimization order.

The user can apply one change, reopen the preview, and evaluate the next one against the new explicit plan.

## Regression requirements

Phase 9 tests cover:

- selected-week Monday–Sunday bounds,
- excluding dates before today,
- evidence-review ordering without auto-selection,
- multiple changes targeting one plan,
- cross-plan conflicts created by a combination,
- atomic failure behavior,
- successful multi-day application,
- source-store immutability during simulation,
- legacy guidance-only behavior.

The full existing test suite and production Vite build must remain green before merge.
