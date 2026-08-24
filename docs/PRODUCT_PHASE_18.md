# Product Phase 18 — Commercial UI Polish

## Goal

Raise the visual and interaction quality of RealitySync to a commercial App Store level without adding product concepts.

The permanent product surface remains:

1. **Plan** — put down the ideal day.
2. **Reality** — record what actually happened.
3. **Reflect** — compare ideal and reality.
4. use that gap to make the next plan a little more realistic.

Phase 18 is intentionally a presentation and usability pass, not a feature phase.

## Visual direction

The UI should feel calm, personal and trustworthy rather than like a dense analytics dashboard.

Principles:

- one strong primary action per state
- white content surfaces on a soft neutral background
- indigo remains the product accent
- green / amber / rose communicate outcomes only where needed
- status colors use accents and small badges rather than tinting whole screens
- typography and whitespace establish hierarchy before decorative elements
- every main action remains comfortably thumb-sized
- advanced internal learning language stays out of the everyday interface

## App shell

- retained the three-tab navigation only: `計画 / 記録 / 分析`
- bottom navigation becomes a floating, high-contrast control while preserving safe-area padding
- selected tab uses a strong indigo surface rather than a subtle text-only state
- header uses one restrained indigo-violet gradient and clearer hierarchy
- date navigation remains a native date-picker target with 44px previous/next controls
- root background is softened so white cards read as intentional surfaces

## Plan

The plan screen remains schedule-first.

Changes:

- stronger `PLAN` → `理想のスケジュール` hierarchy
- empty state now has one obvious first action: `予定を追加する`
- schedule cards use a calm white surface
- time, title, category, duration and planned load remain the visible hierarchy
- planned load uses a compact semantic surface instead of a visually heavy circular gauge
- recorded plans get a quiet badge instead of competing with the plan itself
- the one historical hint remains secondary
- copy/template helpers remain collapsed and tertiary

No planning workflow was added.

## Reality / record timeline

Changes:

- `REALITY` → `今日の現実` establishes the purpose before the graph and timeline
- due-record reminder remains one compact action
- timeline cards use white surfaces plus a thin status accent
- status colors no longer tint the whole card
- `予定通り / 変更 / 休んだ / 未記録` are readable as small badges
- actual timing provenance and missing-time badges are preserved
- deviation reason stays secondary
- load and duration metrics stay compact

Truth correction preserved by the UI:

- missing `actualDuration` displays `—`, never synthetic `0分`
- missing `actualStress` displays `—`, never synthetic zero

No record is inferred by the polish layer.

## Record modal

The Phase 16 field order is preserved:

1. outcome
2. actual duration
3. actual load
4. end mood
5. save

Exact start date/time and optional reason remain under a disclosure panel.

Phase 18 only aligns:

- modal header
- cards
- mode controls
- input surfaces
- sticky primary CTA
- error state

with the commercial visual system.

## Schedule editor

The plan editor is aligned with the same modal system:

- clearer title/input grouping
- primary plan fields in one card
- planned load as its own deliberate card
- one strong save CTA
- destructive delete remains visually secondary

Historical reality preservation behavior is unchanged.

## Reflect / analytics

The daily reading order is intentionally simple:

1. **予定の達成度サマリー**
2. **理想の軌跡 vs 現実の歩み**
3. **記録からの気づき**
4. optional collapsed week/month review

The completion summary becomes more immediately readable without changing how the number is calculated.

No new analytics were introduced.

## Commercial simplicity guardrails

Phase 18 does not add:

- onboarding funnels
- accounts
- social features
- a home dashboard
- extra bottom-navigation destinations
- gamification
- automatic planning
- new analytics
- new experiment management UI
- new persistence fields

A visually polished app must still feel simpler than its internal machinery.

## Regression coverage

`tests/commercialUiSurface.test.js` protects:

- the `Plan / Reality / Reflect` hierarchy
- one clear plan empty-state CTA
- calm white timeline cards with status accents
- truthful `—` for missing actual load/duration
- completion then ideal-vs-reality reading order
- exactly the original three core navigation destinations

`tests/mobileUxSurface.test.js` is updated for the stronger commercial active navigation state while preserving touch targets, date picking, safe areas and the folded record details.

## Verification boundary

Automated CI can verify source-level hierarchy, product guardrails and production compilation.

It cannot prove final visual quality on real hardware. Before App Store submission, RealitySync still needs visual verification on actual iPhone sizes and TestFlight, especially:

- 320–430pt widths
- Dynamic Type / text scaling behavior
- native date/time input presentation
- keyboard interaction with sticky modal actions
- safe-area behavior on Home Indicator devices
- contrast and legibility in the final signed binary
