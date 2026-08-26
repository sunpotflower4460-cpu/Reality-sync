# Product Phase 20 — App Store Surface Polish

## Goal

Phase 20 moves RealitySync from a polished web-app surface toward a calmer, content-first App Store presentation without adding a new product concept.

The product remains:

1. plan the ideal day
2. record what actually happened
3. compare ideal and reality
4. use the comparison to make the next plan a little more realistic

No storage format, truth rule, analytics formula, experiment rule, or historical provenance rule changes in this phase.

## Design principles

### Content before chrome

Navigation should frame the product rather than become the visual subject. The large branded gradient header is replaced with a compact translucent app bar, and the primary tab bar is attached to the bottom edge rather than floating over content.

### Clear visual layers

RealitySync now separates:

- application chrome
- page content
- grouped form/settings surfaces
- modal sheets

The UI should not make every item look like an equally important card.

### 44-point interaction floor

Primary icon controls use a shared 44×44 minimum tap target. Mobile form fields continue using at least 16px input text to avoid iOS focus zoom.

### Native-feeling grouped information

Plan rows, record inputs, and settings use grouped surfaces with separators instead of repeatedly nesting one large rounded card per field.

### Typography hierarchy, not typography force

Routine product copy uses system-first typography and semibold/medium weights. `font-black` is intentionally avoided from the new primary plan surface so hierarchy comes from size, spacing, and placement rather than uniformly heavy weight.

## Main shell

The header is now a light translucent app bar with:

- compact RealitySync identity
- 44-point plan/add and settings controls
- compact date navigation

The date selector uses 44-point previous/next controls and a light grouped surface.

The bottom navigation is edge-attached, safe-area aware, and uses tint/weight to communicate selection. It does not use a large filled active tile or a floating navigation card.

Main content reserves explicit space above the tab bar so the final interactive row is not visually covered.

## Plan

Schedules are presented as one grouped list.

Reading order is:

1. time
2. title
3. category and duration
4. subtle planned-load metadata

The former large time tile and load pill are removed. Planned load remains visible as a small status dot plus text.

Adding another plan remains available but is visually secondary once a schedule already exists.

## Record

The timeline keeps explicit reality data while reducing dashboard density.

Recorded facts remain visible:

- planned time
- actual start when explicitly known
- status
- actual mood
- actual load when known
- actual duration when known
- explicit deviation reason

Unknown values remain unknown. They are never rendered as synthetic zeroes.

The footer uses a compact inline summary instead of three equal metric blocks.

## Record sheet

Routine record inputs are grouped together:

- duration
- actual load
- mood

Status selection and mood use compact segmented controls. Detailed start timing and deviation reasons remain behind an explicit disclosure.

The same truth boundaries remain unchanged: planned data is never used to invent actual timing, duration, mood, stress, or reasons.

## Analytics

The daily analytics hierarchy is calmer:

- “今日の記録” is the top summary
- completion rate remains visible but secondary
- the category comparison is labeled “理想と現実の時間”
- weekly/monthly detail remains collapsed until requested
- one longitudinal insight remains the only advanced learning output in the normal surface

No analytics calculation was changed.

## Settings

Settings now follows an iOS-style grouped-row hierarchy:

- 記録
- データ
- プライバシーとサポート
- アプリ
- データの削除

Backup actions are rows rather than two competing filled buttons. Destructive deletion is isolated into its own section and retains the existing two-step confirmation.

## Accessibility and mobile behavior

Phase 20 preserves or strengthens:

- focus trapping in dialogs
- Escape dismissal on desktop
- previous-focus restoration
- body scroll lock during modal presentation
- safe-area padding
- reduced-motion support
- 16px mobile form inputs
- 44-point icon controls
- explicit labels for icon-only controls

## Regression guardrails

Tests now guard against reintroducing:

- the giant purple hero header
- a floating bottom-navigation card
- filled active tab tiles
- large time tiles and load pills in plan rows
- synthetic zeroes for unknown reality
- three equally heavy routine record cards
- settings as a stack of large cards
- advanced experiment vocabulary in the primary navigation

## Manual validation still required

Automated tests and browser screenshots do not replace real-device validation. Before App Store submission, manually verify at minimum:

- iPhone small and large screens
- dynamic keyboard appearance in record/schedule sheets
- VoiceOver reading order
- Larger Text / Dynamic Type behavior where supported by the web shell
- safe areas on devices with Home Indicator and Dynamic Island
- scroll-to-last-row clearance above the tab bar
- tap comfort for top-bar and tab-bar controls
- long Japanese titles/reasons
- settings backup/import picker behavior
- destructive confirmation flow

Do not treat this document as evidence that those real-device checks have already been completed.
