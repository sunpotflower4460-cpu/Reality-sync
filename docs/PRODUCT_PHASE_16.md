# Product Phase 16 — Mobile UX Polish

## Goal

Polish the original RealitySync loop for daily mobile use without adding product concepts or analytical features.

The product surface remains:

1. make an ideal plan,
2. record what actually happened,
3. compare ideal and reality,
4. use the gap to make the next plan a little more realistic.

## What changed

### App shell

- use dynamic viewport height for mobile browser chrome
- respect top and bottom safe areas
- reduce header density while keeping RealitySync identity and date navigation visible
- give header actions 44px touch targets
- strengthen the active state and touch size of the three bottom tabs

### Date navigation

- the displayed date itself is now the native date-picker target
- previous/next day controls use 44px touch targets
- non-today dates keep a simple explicit `今日に戻る` action
- no new navigation concepts were added

### Plan

- schedule cards stay the primary content
- slightly tighter mobile spacing prevents crowding at 320px widths
- time, title, category, duration and planned load remain the visible information hierarchy
- the one optional historical hint and the collapsed plan helpers remain secondary

### Record

The same data can still be recorded, but the order now matches the everyday task:

1. what happened: planned / changed / rested
2. actual duration
3. actual load
4. end mood
5. save

Exact start date/time and optional change/skip reasons remain available under a disclosure panel. They are not removed or inferred.

### Timeline

- due-record reminders no longer expand into a large list before the core timeline
- one compact reminder entry leads directly to the next pending record
- timeline cards use shorter labels and smaller secondary metadata while retaining the same truth semantics
- missing or legacy start information is shown as compact badges instead of explanatory paragraphs

### Stress / load graph

- the graph is visually framed as `負荷の波`
- plan and actual remain distinct
- truth-preserving notes about legacy or excluded timing are retained under `表示について`
- the notes are hidden from the normal reading path but are not deleted

### Analytics

- daily ideal-vs-reality and completion remain primary
- spacing and labels are tightened for phone widths
- the single plain-language insight remains secondary
- week/month review stays collapsed

## Non-goals

Phase 16 does not add:

- new analytics
- new experiment workflows
- new optimization rules
- new automatic planning behavior
- new persistence fields

## Truth boundaries preserved

- no planned duration becomes hidden reality through analysis code
- no missing start time/date is guessed
- no historical planned snapshot is reconstructed from the current plan
- advanced analytical machinery remains internal and does not become a second product surface

## Regression coverage

`tests/mobileUxSurface.test.js` protects:

- 44px date navigation touch targets
- visible bottom-nav active state and safe-area support
- primary vs optional record-field hierarchy
- folded graph truth notes
- dynamic viewport and safe-area shell behavior

Real-device visual verification is still required for final iPhone/Android spacing and native date/time picker behavior.
