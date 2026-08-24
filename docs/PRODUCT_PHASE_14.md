# Product Phase 14 — Conditional Learning Coverage / Scope Precision

## Goal

Phase 13 allowed a revalidation version to use one explicit, plan-knowable `contextRule`.

Phase 14 asks the next question:

> Did that condition actually make the learning more precise, or did it merely make the rule narrower?

RealitySync must answer this without pretending that an observational split proves causality.

## Two separate questions

### 1. Scope precision before the conditional version

For a conditional v2+ learning, RealitySync looks back at the **previous adopted version's Retention assessment window** at the time the condition was created.

The previous version used the same previous-version learning across that previous-version scope. Phase 14 classifies those Retention usages by the new `contextRule`:

- inside the new condition
- outside the new condition
- unknown / not safely classifiable

Unknown history is never treated as outside the condition.

It then compares the observed failure rates inside vs outside.

Minimum support before a directional label is shown:

- at least 4 usages inside the condition
- at least 4 usages outside the condition
- at least 2 calendar weeks inside
- at least 2 calendar weeks outside

Signals:

- `focused`: inside failure rate is at least 15 points higher than outside
- `reverse`: outside failure rate is at least 15 points higher than inside
- `unclear`: both sides have enough data but the difference is under 15 points
- `collecting`: one or both sides are still too sparse
- `unavailable`: the required previous-version history cannot be reconstructed truthfully

These labels describe **risk separation**, not causal effect.

### Important interpretation

A `focused` result means:

> In the previous version's normal operation, records that would satisfy this condition had a higher observed failure rate than records outside it.

It does **not** mean:

> This condition caused the failures.

It also does not prove that the current countermeasure is ineffective outside the condition.

If the previous version itself already had a context rule, the comparison is explicitly restricted to that previous version's scope.

If the structured plan adjustment changed between the previous and current version, the UI says that the contrast is only evidence about the condition split, not the current countermeasure's outside-scope effectiveness.

## 2. Coverage after adoption

After a conditional version is adopted, RealitySync separately measures how often its condition is encountered in recorded reality.

For recorded schedules that satisfy the experiment's original/base condition:

- `baseConditionCount`: all recorded base-condition schedules
- `insideCount`: safely classifiable schedules inside the `contextRule`
- `outsideCount`: safely classifiable schedules outside the rule
- `unknownCount`: schedules whose historical plan context cannot be reconstructed safely
- `ruleCoverage`: inside / (inside + outside)
- `insideAppliedCount`: inside-rule schedules carrying this experiment's explicit application marker
- `applicationCoverage`: insideAppliedCount / insideCount
- `outsideAppliedCount`: outside-rule schedules carrying the experiment marker

The last value is treated as a data-integrity warning, not as success/failure evidence.

Generated adjustment buffers are excluded from target coverage.

## Truth boundary for outside-scope effectiveness

Phase 14 deliberately does **not** claim whether the current countermeasure works outside the rule.

Why:

Once a conditional version is adopted, RealitySync normally does not propose that countermeasure to outside-rule plans. Therefore those outside-rule records are not treatment trials.

Comparing:

- inside-rule records where the countermeasure was applied
- outside-rule records where it was not applied

cannot establish whether the countermeasure would work outside the rule.

The UI therefore says:

> 条件外で現在の対策を試していない記録から、「条件外では効かない / 効く」とは推定しません。そこを確かめるには、別の明示的な試行が必要です。

A future phase can add an explicit outside-scope generalization challenge if that is useful.

## Unknown is not outside

Phase 13's boolean rule matcher was sufficient for gating future plans, but Phase 14 needs a three-way interpretation for historical analysis:

- known + inside
- known + outside
- unknown

`evaluateContextRule()` therefore exposes:

```js
{
  known,
  matches,
  value,
  rule,
}
```

`contextRuleMatches()` remains the simple boolean API for existing gating behavior.

This prevents missing immutable day-plan history from silently inflating the outside-rule group.

## UI

Conditional adopted Retention cards gain a **条件の切り分け精度** section.

It shows:

- source/previous-version inside failure rate
- source/previous-version outside failure rate
- inside-minus-outside point difference
- evidence counts and week counts
- current post-adoption rule coverage
- current inside-rule application coverage
- unknown historical classifications
- outside-rule application-marker integrity warnings
- explicit non-causal caveats

No condition is changed automatically from these observations.

## Non-goals

Phase 14 does not:

- auto-broaden a condition
- auto-tighten a threshold
- infer that the condition caused the outcome
- treat sparse groups as precision evidence
- classify unknown history as outside the condition
- infer current countermeasure effectiveness outside the condition
- create an outside-scope trial automatically

## Recommended next step

A later phase can implement an explicit **generalization challenge**:

- user explicitly chooses to try the same structured countermeasure outside the current rule
- those attempts are separately marked as deliberate validation trials
- no automatic expansion of the adopted rule
- compare only after enough explicit outside-scope trials

That would answer a different question from Phase 14:

> Does the countermeasure itself generalize beyond the current condition?
