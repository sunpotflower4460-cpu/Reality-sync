# Product Phase 19 — UI / UX Refinement

## Goal

Raise the everyday mobile experience to commercial App Store quality **without adding a new RealitySync workflow or product concept**.

The product axis remains:

1. place an ideal plan,
2. record what actually happened,
3. compare ideal and reality,
4. use that understanding to make the next plan slightly more realistic.

Phase 19 changes presentation, hierarchy and interaction friction only. Existing truth, storage, historical provenance, learning and safety behavior remain unchanged.

## Main refinements

### 1. Less visual chrome

- reduce header height, shadow and button weight
- reduce bottom-navigation height and replace the large solid active block with a quieter active surface
- keep exactly three primary tabs: Plan / Record / Analytics
- reduce repeated count pills and decorative badges when plain text communicates the same thing

### 2. Native-feeling mobile sheets

Everyday secondary flows use one shared responsive modal rule:

- bottom sheet on small screens
- centered dialog on larger screens
- mobile drag-handle affordance
- safe-area-aware sticky actions
- existing focus trap, Escape handling and scroll lock preserved

This applies to record entry, schedule editing, settings, templates, plan hints and legal pages.

### 3. Plan hierarchy

Plan cards emphasize:

- time
- title
- category / duration

Planned load remains visible but becomes secondary metadata. The previous pencil icon and competing left accent are removed from the plan list. Recorded state is represented quietly.

### 4. Reality timeline

- tighten vertical rhythm without removing recorded details
- keep status color as a small accent rather than a tinted card surface
- make deviation reasons read like contextual notes rather than error panels
- reduce reminder and pending-record CTA weight
- make the stress graph shorter while preserving exact timing / provenance rules and disclosure notes

### 5. Analytics without score pressure

Completion percentage remains available, but no longer appears as a dominant giant score. The primary summary reads as recorded counts plus a secondary percentage.

Copy explicitly frames results as material for the next plan, not a grade.

The normal analysis order remains:

1. completion summary
2. ideal vs reality
3. one natural insight
4. optional weekly / monthly detail

### 6. Settings hierarchy

Settings are reorganized in everyday priority order:

1. record reminder
2. backup / restore
3. privacy and support
4. app information
5. destructive local deletion

Deletion remains explicit and two-step-confirmed but is no longer rendered as a large alarming card during normal settings use.

### 7. iPhone form behavior

- mobile text/select/textarea controls use at least 16px input text to prevent Safari/WKWebView focus zoom
- load sliders use a larger custom thumb for touch interaction
- buttons use touch-action manipulation
- details disclosure indicators are consistent

## Non-goals

Phase 19 does **not** add:

- new analytics concepts
- another navigation destination
- an experiment dashboard
- automatic schedule optimization
- cloud/account features
- new data inference

Advanced internal learning remains implementation detail and may only surface as the existing single natural plan hint.

## Truth boundaries preserved

- plans never become invented reality
- missing actual duration / time / date stays unknown
- historical plan truth is not reconstructed from current mutable plans
- analytics descriptions do not become causal claims
- RealitySync never auto-applies learned changes to plans
- old data warnings remain available through progressive disclosure

## Regression expectations

Automated tests should continue to verify:

- only Plan / Record / Analytics exist in primary navigation
- mobile input zoom prevention and touch slider affordance
- mobile sheet behavior across everyday modal flows
- plan load metadata remains secondary
- completion percentage remains informational rather than a dominant score
- settings still exposes privacy, support, backup and full local deletion
- all existing product truth and storage tests remain green
