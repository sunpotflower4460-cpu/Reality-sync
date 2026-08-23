# Product Phase 11 — Revalidation & Learning Versions

RealitySync must not treat an adopted experiment as permanent truth.
Phase 10 detects when an adopted learning no longer reproduces as well in normal operation. Phase 11 turns that review signal back into a new explicit experiment without rewriting the old evidence.

## Core model

Each experiment now belongs to a learning lineage:

- `learningRootId` — stable lineage identity
- `parentExperimentId` — experiment whose learning triggered this revalidation
- `learningVersion` — `v1`, `v2`, `v3`, ...
- `revalidationReason` — descriptive reason the new version was opened
- `sourceRetention` — immutable snapshot of the normal-operation evidence that triggered revalidation

An original candidate experiment starts at `v1`. A revalidation creates a new experiment record. It never changes the trials, decision, baseline, or adoption date of the prior version.

## Revalidation boundary

A revalidation can be created only when:

1. the source experiment is completed and explicitly adopted;
2. the source has a trustworthy adoption date;
3. Phase 10 marks its current retention summary as a review candidate;
4. the retention summary is evaluated through today;
5. no other experiment in the same learning lineage is currently active;
6. the new experiment starts tomorrow or later.

This prevents old normal-operation records from being retrospectively relabeled as intervention trials.

## New comparison baseline

A revalidation does **not** reuse the historical baseline from the original v1 experiment.

Instead, it snapshots the recent normal-operation failure rate that triggered the review candidate:

- recent failure rate
- assessment sample count
- number of observed weeks
- prior experiment-period failure rate
- deterioration in percentage points
- assessment through-date

That recent normal-operation rate becomes the new version's baseline. The new question is therefore:

> Does the revised intervention improve on the way this learning is performing **now**?

It is not a claim that the older learning was wrong. Living conditions may have changed.

## Current learning vs history

Version history and active planning are deliberately different concepts.

- every version remains visible in the lineage history;
- future planning uses only the **latest version in the lineage that was explicitly adopted**;
- if v2 is rejected, v1 remains the current adopted learning;
- if v2 is adopted, v1 remains historical evidence but no longer produces future planning suggestions;
- while v2 is still being tested, the previous adopted version remains current until a new decision is made.

Retention monitoring follows the same rule: only the current adopted version in each lineage is monitored as the present learning.

## User flow

1. An adopted learning accumulates marked normal-operation usage.
2. Retention reaches at least 8 uses across at least 3 weeks.
3. Normal-operation failure rate is at least 15 points worse than the experiment-period rate.
4. RealitySync shows **再検証候補**.
5. On today's view, the user chooses **再検証**.
6. A setup modal shows `vN → vN+1`, the observed deterioration, and tomorrow's start boundary.
7. The user may keep or change the intervention text and structured plan adjustment.
8. The new version starts with no trials and uses the captured recent normal-operation rate as baseline.
9. The new version goes through the same explicit trial capture and adopt/hold/reject decision as every other experiment.

## Non-goals and safety boundaries

Phase 11 does not:

- auto-reject an older adopted learning;
- auto-adopt a new version;
- infer a revised intervention from free text;
- backfill old records into a revalidation;
- claim that version improvement proves causality;
- delete superseded evidence;
- allow a parent experiment to be deleted from the UI while child versions depend on it.

## Backup integrity

Lineage metadata is part of experiment history. Backup restore rejects data when:

- a child references a missing parent;
- parent and child disagree about the root lineage;
- a child's version does not advance beyond its parent;
- a supplied retention snapshot is malformed;
- lineage metadata would be silently normalized away.

Old backups without lineage metadata remain compatible: an old standalone experiment normalizes as its own `v1` lineage.

## Interpretation

`v2` does not mean “v1 was false”. It means:

> RealitySync observed that the currently adopted learning may no longer reproduce as well, so a new intervention version was tested under newer conditions.

The lineage is an audit trail of how planning knowledge changed with reality, not a sequence of absolute truths.
