# RealitySync — Debugging Baseline

## 2026-08-23: initial prototype review

The first prototype established the core product loop well: plan an ideal day, record what actually happened, and compare the two without treating deviation as failure.

This pass focused on correctness and maintainability before adding larger features.

## Fixed in the first refactor

1. **Skipped time was being fabricated as actual rest time**
   - The prototype added the full planned duration to a `休息・スキップ` actual category whenever a schedule was skipped.
   - A skip does not prove that the user spent the same duration resting.
   - The refactor records skipped actual duration as `0` unless a future explicit rest activity is recorded.

2. **Changed activities reused the planned duration**
   - Analytics is supposed to compare ideal minutes with real minutes.
   - Changed records now capture `actualDuration` explicitly.

3. **High stress produced a predictive statement without enough data**
   - A single `actualStress > 80` value previously displayed a message saying schedule changes/skips become more likely afterward.
   - The UI now only reports the observation and invites the user to inspect surrounding records.
   - Future predictive/correlation wording should require adequate longitudinal data.

4. **Schedule time was stored twice**
   - The prototype had both `time: "07:00"` and `timeValue: 7`.
   - The refactor derives numeric hours from `time`, preventing drift between two sources of truth.

5. **Changed records could be saved with an empty replacement activity**
   - The record modal now validates the replacement title.

6. **Refresh lost all records**
   - Demo state now persists in `localStorage` with a reset action.

7. **Large single-file component**
   - The original app combined state, analytics, graph rendering, navigation, plan view, tracking view and modals in one file.
   - These responsibilities are now separated into focused modules.

8. **Accessibility gaps**
   - Interactive timeline cards are real buttons.
   - Icon-only actions have labels.
   - The record modal declares dialog semantics and supports Escape/backdrop close.
   - Reduced-motion preferences are respected.

9. **Unconfigured animation/safe-area utility classes**
   - The prototype referenced utility classes that are not guaranteed by core Tailwind configuration.
   - The base stylesheet now defines the required animation and safe-area behavior explicitly.

## Regression tests currently included

- time string → numeric hour conversion
- skipped schedules do not create fictional actual time
- changed schedules use recorded category and duration
- analytics duration formatting

## Deliberately not implemented yet

- real schedule creation/edit/delete
- dates and multi-day data model
- weekly/monthly analytics
- reasons for change/skip
- notifications
- statistically defensible habit-synergy analysis
- AI recommendations
- sync/account/backend

These should be added after the single-day record → analysis loop is manually validated.
