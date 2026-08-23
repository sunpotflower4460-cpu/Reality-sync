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

## 2026-08-23: second data-integrity pass

10. **Persisted data was trusted after only an array check**
   - A syntactically valid but malformed localStorage payload could feed invalid times, categories, durations, stress values, statuses and duplicate IDs directly into rendering and analytics.
   - Persisted schedules are now normalized field-by-field before entering application state.
   - Invalid numeric values are clamped, invalid clock values fall back safely, unsupported categories are mapped to `その他`, duplicate IDs are dropped, and unusable payloads fall back to clean demo data.

11. **Malformed changed records could remain internally contradictory**
   - A stored `changed` record without a replacement activity could contain actual mood/stress/duration while being impossible to display correctly.
   - Such records now return to `pending` with their actual-only fields cleared so the user can record them again.

12. **Correcting a skipped record could preserve a zero-minute duration**
   - Editing a previously skipped item and switching it to `as_planned` or `changed` started from the skipped `0` minute value.
   - Leaving the modal without manually correcting duration could save a false zero-minute completed activity.
   - Status transitions from `skipped` now restore the planned duration as the editing baseline.

13. **Timeline order depended on storage order**
   - Plan and Track views rendered the array as stored, while the stress graph sorted independently.
   - A future edit/import could therefore show inconsistent ordering between the timeline and graph.
   - Chronological sorting is now centralized in one pure utility and reused across views.

14. **Very early schedules could render outside the stress graph**
   - The graph assumed a fixed 06:00 start.
   - If a future schedule is placed before 06:00, the graph now expands its time scale to midnight instead of drawing the point off-canvas.

15. **Multiple open tabs could drift apart**
   - localStorage updates were written but other open RealitySync tabs were not listening for them.
   - The persistence hook now consumes `storage` events and normalizes incoming values before syncing state.

16. **Reset was a destructive one-tap action**
   - The header reset button immediately discarded the local demo record set.
   - Reset now requires confirmation and closes any open editing/plan modal before replacing state.

17. **Plan placeholder dialog did not support Escape**
   - The record dialog supported Escape, but the plan placeholder did not.
   - Both modal paths now support keyboard dismissal.

## Regression tests currently included

- valid and invalid clock parsing
- chronological ordering without mutating source arrays
- skipped schedules do not create fictional actual time
- changed schedules use recorded category and duration
- corrupted numeric/category values are normalized
- malformed changed records are reset to a consistent pending state
- duplicate/unusable persisted entries are handled safely
- skipped → active status duration restoration
- aggregation is protected from hostile category object keys
- malformed JSON restores clean demo schedules
- persisted records are normalized before reaching UI state
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
