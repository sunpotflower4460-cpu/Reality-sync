# Product Phase 13 — Context-aware learning rules

## Goal

RealitySync can now observe that an adopted learning weakened, compare earlier vs recent recorded context, and version the learning through revalidation. Phase 13 adds one more conservative step:

> optionally test a new learning version only inside one explicitly selected, plan-knowable context.

Example:

- v1: add a 15 minute buffer before Tuesday work
- Retention weakens
- Context Shift observes that total planned minutes are much higher in the recent period
- user explicitly chooses: `1日の予定時間が210分以上の時だけ`
- v2 tests a 30 minute buffer only inside that condition

The condition is not treated as a cause. It is a scoped experimental boundary.

## Truth boundary

RealitySync still does not infer why performance changed.

Phase 13 only allows Context Shift dimensions that are knowable when a future plan is being reviewed:

- target planned stress
- target planned duration
- full-day planned minutes
- full-day plan count
- full-day mean planned stress
- full-day planned category share

Post-outcome signals are deliberately excluded from automatic future-plan gating:

- actual stress
- mood

Those may remain useful observations, but they are only known after reality happened.

## One condition only

A revalidation version may have either:

```js
contextRule: null
```

or one structured condition:

```js
{
  metric: 'day-planned-minutes',
  operator: 'gte',
  threshold: 210,
  category: null,
  sourceCandidateId: 'day-planned-minutes',
  sourcePreviousValue: 120,
  sourceRecentValue: 300,
  sourceThroughDateKey: '2026-08-24'
}
```

Phase 13 does not support AND/OR combinations. This intentionally avoids a combinatorial rule system before there is enough evidence to justify it.

## Boundary proposal

When the user selects a Context Shift candidate, RealitySync proposes the midpoint between the earlier and recent observed values as the experimental boundary.

Example:

- earlier: 120 min/day
- recent: 300 min/day
- proposed boundary: 210 min/day or more

The user still explicitly selects whether to add that condition. No Context Shift candidate is auto-selected.

The midpoint is a practical experimental split, not an estimated causal threshold.

## Contextual baseline

If a context rule is selected, the new version is not compared against the full recent Retention rate.

Instead RealitySync rebuilds the baseline from only the recent normal-operation records that satisfy the selected rule.

Minimum support:

- at least 4 matching uses
- across at least 2 calendar weeks

If this support is missing, conditional revalidation cannot start. The user can still revalidate without a context rule.

## Experiment matching

A conditional experiment record must satisfy both:

1. the original learning condition, such as weekday/category/planned stress
2. the new `contextRule`

This same boundary is used for:

- eligible experiment trial records
- post-adoption Retention
- future plan feedback
- weekly plan feedback through the existing plan-feedback engine

Records outside the context are not treated as failures or successes for that conditional version. They are simply outside the version's scope.

## Full-day context evaluation

For day-level rules, RealitySync reconstructs the plan using:

- current plan fields for pending schedules
- immutable `plannedSnapshot` for recorded schedules

If a recorded schedule lacks a historical plan snapshot, the day-level condition is not considered safely evaluable.

Experiment-generated `調整バッファ` schedules are excluded from day-load context so the intervention itself does not push the day across its own rule threshold.

## Adoption semantics

If a conditional v2 is adopted:

- v2 becomes the current adopted version in its lineage
- future plan feedback is shown only when both the original condition and v2 context rule match
- v1 remains historical evidence
- the context rule is visible in experiment history and plan-feedback preview

If v2 is rejected, v1 remains the current adopted version as before.

## Backup integrity

`contextRule` is part of experiment evidence.

Backup restore rejects malformed context rules instead of silently dropping them and broadening a conditional learning into an unconditional one.

Older experiments without `contextRule` remain compatible and normalize to `null`.

## Explicit non-claims

Phase 13 does not claim:

- the selected context caused the earlier learning to weaken
- the midpoint is an optimal threshold
- a successful conditional v2 proves an interaction effect
- unrecorded context can be inferred
- multiple context dimensions can safely be combined

The product claim is narrower:

> under one explicitly chosen recorded planning condition, this version of the intervention was or was not reproduced.

## Regression expectations

Automated coverage should protect at least:

- only plan-knowable Context Shift candidates can become rules
- generated adjustment buffers do not affect day-load rule matching
- contextual baselines use only matching recent normal-operation records
- conditional revalidation is blocked when matching baseline support is too sparse
- a revalidation version persists its context rule and contextual baseline
- eligible experiment records outside the rule are excluded
- adopted future-plan suggestions outside the rule are excluded
- malformed backup context rules are rejected rather than widened

Full existing test suite and production build must remain green before merge.
