# Product Phase 8 — Adopted Learning Back Into Planning

## Goal

Phase 8 closes the product loop from an adopted small experiment back into a future plan.

The core rule is:

> RealitySync may remember an adopted intervention and offer it again, but it must never rewrite a future plan without a per-plan preview and explicit approval.

## Flow

1. Phase 6 finds an evidence-aware candidate.
2. Phase 7 turns an eligible candidate into an explicit small experiment.
3. The user records only runs where the intervention was actually attempted.
4. The user explicitly chooses `adopt` after the target runs.
5. Phase 8 matches the adopted experiment condition against future pending plans.
6. The Plan tab shows a learned-planning suggestion.
7. The user opens a before/after preview for one target plan.
8. RealitySync validates date boundaries, record status, schedule overlap and minimum duration.
9. Only after explicit approval is the structured adjustment applied.
10. The target plan records which adopted experiment is already baked into it so the same learning is not proposed twice.

## Free text is never parsed into a plan mutation

Phase 7 stores a human-readable `action` string. That text can describe any intervention and cannot be treated as a safe machine instruction.

Phase 8 therefore adds a separate optional `planAdjustment` field to experiments.

Supported structured adjustments:

- `buffer-before`: insert a pending `調整バッファ` plan immediately before the target
- `shorten-duration`: shorten the target duration
- `shift-start-later`: move the target start later
- `null`: guidance only

The free-text action remains visible as context, but plan mutation is derived only from the explicit structured field.

## Experiment setup

New experiments can select a reusable planning adjustment independently from the free-text intervention description.

Current choices in the UI:

- 15-minute buffer before
- 30-minute buffer before
- shorten by 15 minutes
- shift start 15 minutes later
- guidance only

Candidate families still provide a default suggestion, but the user can change the structured choice before the experiment starts.

## Adoption date boundary

New experiment decisions store `decisionDateKey` using the user's local calendar date.

A structured adopted adjustment is eligible only on or after that local adoption date.

This prevents a later adoption from being applied retroactively to an older plan.

Legacy completed experiments without a trustworthy `decisionDateKey` remain useful as guidance, but structured one-click application is disabled even if imported data happens to contain an adjustment.

## Eligible plan boundary

Planning feedback is shown only when:

- the experiment is completed
- the explicit decision is `adopt`
- the selected plan is still `pending`
- the experiment condition matches the selected plan/date
- the selected date is not before the experiment adoption date when known
- the plan has not already recorded that experiment as applied

`App` additionally exposes planning feedback only for today or future dates. Past dates remain historical rather than being rewritten by learned recommendations.

## Before/after preview

Every structured application opens a modal showing:

- source experiment
- intervention description
- frozen historical failure rate
- experiment failure rate
- number of captured trials
- reusable structured adjustment
- current plan
- proposed resulting plan
- inserted buffer plan when applicable

There is no batch auto-apply path in Phase 8.

## Safety validation

### Buffer before

A buffer is blocked when:

- it would start on the previous calendar day
- its interval overlaps another plan

When accepted, RealitySync inserts a separate pending plan:

- title: `調整バッファ`
- category: `休憩`
- planned stress: `0`
- duration: the explicit adjustment minutes

### Shorten duration

A shortening is blocked when the resulting duration would be under 5 minutes.

### Shift start later

A shift is blocked when:

- the shifted plan would cross midnight
- the shifted interval would overlap another plan

### Recorded plans

Any plan with an existing reality record is never mutated by Phase 8 feedback.

## Avoiding duplicate application

Schedules now carry:

`appliedExperimentIds: string[]`

The marker means the current plan already incorporates that adopted experiment.

It is plan metadata, not evidence that a future intervention was actually executed. Actual experiment exposure is still recorded only through Phase 7's explicit trial-capture action.

The marker is preserved when a user deliberately copies an already-adjusted plan or saves it as a template. This avoids inserting the same learned buffer twice into a plan that already includes it.

It is not copied into `plannedSnapshot`, because the snapshot's purpose is to preserve the semantic plan baseline used for reality comparison.

## Legacy behavior

Older experiments can have:

- no `planAdjustment`
- no `decisionDateKey`

RealitySync does not infer either field from free text or timestamps.

Those adopted experiments may be shown as guidance on current/future matching plans, but the UI does not offer one-click mutation.

## Evidence boundary remains unchanged

An adopted experiment is still a small personal observation, not causal proof.

Phase 8 reuses a user-adopted intervention because the user explicitly chose to keep it, not because RealitySync has declared the intervention universally correct.

The app still does not:

- infer causal habit synergy
- batch-rewrite a week automatically
- parse arbitrary advice text into executable schedule changes
- modify historical recorded plans
- silently resolve plan conflicts
