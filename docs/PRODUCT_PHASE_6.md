# Product Phase 6 — Historical Truth & Insight Candidates

## Goal

RealitySync now moves from descriptive daily/weekly/monthly review into longitudinal pattern screening.

The purpose of this phase is **not** to tell the user what causes their behavior. It is to identify patterns that are repeated and large enough to be worth testing next, while keeping the underlying evidence visible.

## 1. Freeze both sides of history

Before Phase 6, RealitySync already preserved recorded reality fields such as actual title/category/duration/start time. However, a recorded schedule could still have its current plan fields edited later.

New records now persist:

```js
plannedSnapshot: {
  time,
  title,
  category,
  duration,
  plannedStress
}
```

This snapshot is created **only when a pending plan is first recorded**.

Rules:

- later plan edits do not mutate the snapshot
- copying a day/template never copies the snapshot
- old recorded entries without a snapshot remain `null`
- RealitySync does not infer an old snapshot from the plan visible today
- plan-based longitudinal candidates exclude old entries without a snapshot

The existing v2 day-store envelope remains compatible because `plannedSnapshot` is an optional normalized record field.

## 2. Longitudinal window

The new Analytics `傾向` scope screens records from the selected date backwards for at most 180 calendar days.

Future dates are excluded even if plans exist there.

The readiness summary exposes:

- recorded count
- number of represented months
- original-plan snapshot coverage
- exact start-date/time sample count
- reason-bearing deviation count
- first and last included dates

## 3. Candidate families

Phase 6 currently screens:

1. weekday deviation rate vs all other weekdays
2. weekday rate of starts at least 20 minutes late vs all other weekdays
3. plans with original planned stress >= 70 vs < 70
4. original planned category vs all other categories
5. repeated explicit change/skip reasons

No same-day sequence or habit-synergy causality is generated yet.

## 4. Minimum evidence gates

For two-rate comparisons:

- group must have at least 4 samples
- comparison group must have at least 8 samples
- absolute rate difference must be at least 15 percentage points

Some candidate families impose stronger entry gates before the shared comparison logic.

These thresholds are product guardrails for exploratory screening, not universal statistical rules.

## 5. Uncertainty

Rate cards include a 95% Wilson score interval for each compared rate.

RealitySync does **not** relabel interval separation as a formal p-value or proof of significance.

The evidence labels are product-level longitudinal evidence states:

- `探索中`
- `反復観測`
- `比較的安定した観測`

They use sample size, number of observed months, effect magnitude, and for the highest level, separation of the displayed Wilson intervals.

They are not probabilities that a hypothesis is true.

## 6. Multiple comparisons

The engine scans several weekdays and categories at once. That creates a multiple-comparison problem: an apparently large difference can occur by chance because many candidates were inspected.

The UI states this explicitly.

Phase 6 therefore treats every output as a **candidate for replication**, not a final conclusion.

A future experiment-validation layer should track whether a candidate reappears after an intentional planning change or in a later time window.

## 7. Reason text

Repeated reasons are matched by exact trimmed text only.

For example, `眠気` and `ねむい` remain separate observations.

RealitySync does not currently use semantic clustering to merge them, because doing so would introduce another inference layer that needs its own transparency and review controls.

## 8. What remains locked

The product still does not automatically claim statements such as:

- exercising improves later work performance
- high actual stress causes the next plan to fail
- a weekday itself causes deviations
- a mood causes schedule changes

Those require stronger temporal structure, repeated observations, and treatment of plausible confounders.

The next product phase should turn selected candidates into small, reversible experiments and measure whether the observed pattern changes, rather than immediately escalating candidates into prescriptive AI advice.
