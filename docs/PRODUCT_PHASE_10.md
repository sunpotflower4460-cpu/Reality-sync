# Product Phase 10 — Learning Retention

## Goal

RealitySync must not treat an adopted experiment as a permanent truth.

Phase 10 adds a derived retention layer that asks a narrower question:

> After an adjustment was explicitly adopted and reused in normal planning, does the same observed metric still look similar to the experiment period?

This is a maintenance/review signal, not proof that the adjustment caused the outcome.

## What counts as normal-use evidence

A recorded schedule is eligible only when all of the following are true:

1. the source experiment is completed and explicitly adopted;
2. the experiment has a trustworthy local `decisionDateKey`;
3. the schedule date is on or after that adoption date and no later than the selected analysis date;
4. the schedule is recorded, not pending;
5. its `appliedExperimentIds` explicitly contains the experiment id;
6. the schedule still matches the source experiment condition;
7. the source experiment metric can be measured truthfully from that record.

For generated `buffer-before` plans, the synthetic `調整バッファ` record itself is excluded from the target outcome so one applied learning is not double-counted.

Unmarked matching schedules are not silently treated as if the adopted learning had been used.

## Assessment window

Retention uses the latest at most 12 attributable normal-use records.

A retained/review judgment requires at least:

- 8 attributable records; and
- observations spanning 3 distinct Monday-based weeks.

Before both thresholds are met, the state remains `collecting`.

## Signals

The normal-use failure rate is compared with the failure rate observed in the original explicit experiment.

- `maintained`: normal-use failure rate is no more than 10 percentage points above the experiment period.
- `watch`: enough data exists, but deterioration is between 11 and 14 points.
- `review`: normal-use failure rate is at least 15 points above the experiment period.
- `unavailable`: the original experiment or adoption boundary is not comparable truthfully.
- `collecting`: not enough repeated normal-use evidence yet.

A `review` signal does **not** automatically reject the adopted adjustment or rewrite future plans. It only returns the learning to a revalidation-candidate state.

## Uncertainty

The UI also shows a 95% Wilson interval around the recent normal-use failure rate.

This interval is descriptive support. Phase 10 does not claim:

- causal effect;
- statistical significance between the experiment period and retention period;
- that environmental/context changes are controlled;
- that a maintained effect will continue indefinitely.

## Legacy handling

Older adopted experiments without a trustworthy `decisionDateKey` are not given a synthetic adoption boundary. They remain visible as historical adopted learning, but retention is `unavailable` rather than fabricated.

## Product meaning

The learning loop is now:

1. observe reality;
2. surface a candidate pattern;
3. explicitly run a small experiment;
4. explicitly adopt or reject it;
5. reuse adopted learning in future plans;
6. observe the adopted learning in normal operation;
7. keep observing it if stable;
8. return it to a revalidation candidate if normal operation materially deteriorates.

RealitySync therefore treats learned planning rules as revisable knowledge, not permanent personal labels.
