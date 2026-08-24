# Product Phase 12 — Context Shift candidates

## Goal

When an adopted learning moves into the Phase 10 `review` state, RealitySync should help answer a narrower question:

> What explicitly recorded conditions were different when the learning appeared to hold versus when recent normal operation deteriorated?

This phase does **not** answer why the learning stopped working. It only surfaces descriptive co-occurring changes that may be worth checking during revalidation.

## Comparison windows

Context Shift is only evaluated for the **current adopted version** of a learning lineage when its Retention signal is `review`.

- **Recent deterioration window**: the same latest-at-most-12 attributable normal-use records used by Retention.
- **Earlier normal-operation window**: up to 12 attributable records immediately before the recent window.

The earlier window must contain at least:

- 8 attributable uses, and
- 3 Monday-based weeks.

It must also remain within +10 percentage points of the original experiment-period failure rate. If the earlier window was already substantially degraded, RealitySync does not label it an earlier stable period and does not produce Context Shift candidates.

## Explicit-data-only policy

RealitySync never fills missing context from plan defaults.

### Target-plan context

Uses only immutable `plannedSnapshot` values from the recorded target schedule:

- planned stress
- planned duration

### Actual context

Uses only fields that are explicitly present in the raw stored record:

- `actualStress`
- `mood`

This intentionally bypasses normalization fallbacks. A legacy record with no raw `actualStress` or `mood` is missing context, not a synthetic normal/plan-matching value.

### Full-day context

Full-day metrics are calculated only when every non-buffer schedule on that historical day:

- is recorded rather than pending, and
- has an immutable `plannedSnapshot`.

If a historical day contains a mutable pending plan or a legacy recorded plan without a snapshot, full-day metrics for that day are withheld.

Generated `調整バッファ` schedules belonging to the experiment are excluded so the intervention itself is not mistaken for an environmental change.

## Screened context dimensions

Current Phase 12 candidates:

- target planned stress — minimum 10 point difference
- target planned duration — minimum 15 minute difference
- explicit actual stress — minimum 10 point difference
- explicit bad-mood rate — minimum 20 point difference
- full-day planned minutes — minimum 60 minute difference
- full-day plan count — minimum 2 plan difference
- full-day mean planned stress — minimum 10 point difference
- full-day category time shares — minimum 20 percentage point difference

Each metric also requires at least 6 usable observations in both windows. Up to six largest threshold-normalized differences are shown.

These thresholds are product screening rules, not statistical significance tests.

## UI semantics

The Trends screen shows a dedicated Context Shift section only when a current adopted learning is already a Retention review candidate.

For each learning it shows:

- earlier and recent date windows
- failure rate / sample count / week count for both windows
- large explicit condition changes
- the actual sample counts used by each condition
- provenance notes describing which records were eligible

The UI uses language such as:

- `Context Shift候補`
- `同時に変わっていた条件`

It explicitly avoids:

- `原因`
- `原因候補`
- `〜のせい`
- causal confidence claims

## Missing context

RealitySync does not infer unrecorded factors such as:

- sleep
- weather
- relationships
- health state beyond explicitly stored fields
- work intensity not represented in the stored schedule/actual-stress fields

If none of the recorded dimensions cross the screening thresholds, the result says that no large recorded Context Shift was found. It does **not** say that the environment did not change.

## Version semantics

Phase 11 learning lineage rules remain authoritative:

- superseded adopted versions remain historical evidence
- only the latest adopted version in a lineage is used for future planning and Retention
- Context Shift follows that same current-version boundary

A superseded v1 can still be inspected historically, but it does not automatically reappear as a current Context Shift card after v2 becomes the adopted version.

## Integrity principle

**A Context Shift is a descriptive difference between two explicit observation windows, not an explanation.**

The intended flow is:

`Retention deterioration → Context Shift candidates → human interpretation → explicit revalidation experiment`

not:

`Retention deterioration → automatic causal diagnosis → automatic plan rewrite`
