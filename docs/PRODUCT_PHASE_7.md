# Product Phase 7 — Explicit Experiment Validation Loop

## Goal

Phase 7 turns a longitudinal insight candidate into a small, auditable experiment without turning an observed association into an automatic recommendation.

The core product rule is:

> RealitySync may suggest what to test, but it must never claim the intervention happened unless the user explicitly marks a recorded activity as a trial.

## Flow

1. A candidate appears in **分析 → 傾向** after the Phase 6 evidence gates.
2. Only candidates with a measurable elevated failure outcome can start an objective experiment.
3. Experiment creation is allowed only from **today's** longitudinal view. Historical/future views are read-only for experiment creation.
4. RealitySync proposes a small intervention. The user can edit it.
5. The user chooses a target of 3–10 trials.
6. RealitySync snapshots the previous 180-day failure rate for the same condition.
7. The experiment becomes effective on the **next calendar day**, so records that already existed when the experiment was created cannot be enrolled retroactively.
8. Future matching recorded activities become **eligible**, but they are not experiments yet.
9. The user presses **対策を試した** only for a run where the intervention was actually attempted.
10. RealitySync snapshots that run's observed outcome.
11. After the target count, RealitySync compares the experiment failure rate with the frozen historical baseline.
12. The UI describes the direction as improving / unclear / worsening.
13. The user explicitly chooses **採用 / 保留 / 見送り**.

No future schedule is modified automatically.

## Supported experiment families

### Weekday change/skip

Condition: one weekday.

Outcome: whether the recorded activity was `予定通り` versus `変更 / スキップ`.

Default intervention: add 15 minutes of buffer around the target day's schedule.

### Weekday late start

Condition: one weekday.

Outcome: whether exact actual start was at least 20 minutes later than the original recorded plan.

Requirements:

- original `plannedSnapshot`
- actual start date
- actual start time

A skipped or time-unknown record is not silently converted into a timing result.

### High planned stress

Condition: original planned stress >= 70.

Outcome: change/skip versus as-planned.

Default intervention: shorten the plan slightly or add a 15-minute rest buffer.

### Planned category

Condition: original planned category.

Outcome: change/skip versus as-planned.

Default intervention: add a small buffer around that category.

### Repeated free-text reasons

These remain observational in Phase 7. A repeated reason such as `眠気` does not by itself define an objectively measurable intervention/exposure pair, so RealitySync does not fabricate an experiment from it.

## Historical baseline

The baseline is calculated at experiment creation and stored inside the experiment.

It uses the trailing 180 days ending on the creation-day anchor and the same condition/metric as the experiment.

This matters because historical source data may later be edited. The experiment baseline must not silently drift after the experiment has started.

## Non-retroactive start boundary

RealitySync deliberately separates the **baseline day** from the **effective experiment start**.

- candidate and baseline are evaluated as of today
- the experiment becomes effective tomorrow
- records from today or earlier cannot be added as new experiment trials

This prevents a user from navigating to an old date and reconstructing an intervention group after seeing the outcomes.

## Explicit exposure boundary

A matching recorded activity is only **eligible**.

It becomes a trial only when the user explicitly presses `対策を試した`.

This prevents the following false inference:

- plan changed
- therefore intervention must have been applied

RealitySync cannot know that from schedule data alone.

## Trial snapshot

When a trial is captured, RealitySync stores:

- date
- schedule id
- recorded plan title
- success/failure outcome
- observed timing value when applicable
- capture timestamp

Later edits to the source schedule do not rewrite the captured trial. An active trial can be removed and re-captured if the user needs to correct it.

## Result language

After the target run count:

- **改善方向**: experiment failure rate is at least 15 percentage points below baseline
- **まだはっきりしない**: difference is within ±14 points
- **悪化方向**: experiment failure rate is at least 15 points above baseline
- **比較基準なし・要確認**: target is reached but a baseline could not be formed

These are directional product labels, not causal proof, p-values, or confidence probabilities.

## Decision boundary

Even when an experiment is labeled `改善方向`, RealitySync does not automatically adopt the intervention.

The final experiment decision is explicitly stored as one of:

- `adopt`
- `hold`
- `reject`

This is intentionally separate from the computed signal.

## Persistence

Experiments use a separate versioned local key:

`reality-sync:experiments:v1`

Stored experiment history is also included in the normal RealitySync JSON backup. Existing backup v1 files created before Phase 7 remain readable; they restore with an empty experiment list.

## Still locked

Phase 7 does **not** unlock automatic habit-synergy causality such as:

- exercise caused better work performance
- sleep caused fewer changes
- one preceding activity caused another activity to start on time

Those analyses need temporal ordering, repeated exposures, clearer confounder handling, and stronger longitudinal design.
