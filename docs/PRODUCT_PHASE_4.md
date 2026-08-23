# Product Phase 4 — Exact timing and monthly observation

This phase moves RealitySync from clock-only timing toward exact local-calendar reality and adds a monthly observation layer.

## Implemented

- `actualStartDateKey` alongside `actualStartTime`
- exact date-aware planned-vs-actual start deltas
- cross-midnight handling without guessing
- legacy clock-only records remain undated rather than being inferred
- daily graph support for adjacent-day actual starts
- Day / Week / Month analytics scopes
- monthly totals, weekly progression and repeated-weekday observations
- sample counts and descriptive wording for weekday observations

## Data integrity boundary

RealitySync must not infer an actual start date from a planned date for previously stored clock-only records. New records may prefill the selected plan date in the form, but that date becomes reality data only when the user saves the record.

Weekday, mood, load and deviation-reason summaries remain descriptive. Causal or stable behavioral claims require more longitudinal evidence than this phase provides.
