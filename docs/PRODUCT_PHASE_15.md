# Product Phase 15 — Simplicity Reset

## Why this phase exists

RealitySync started from a very small product idea:

1. place the **ideal schedule**,
2. record **what actually happened**,
3. compare ideal and reality,
4. use that gap to make the next plan a little more realistic.

Phases 6–14 added truthful longitudinal analysis, experiments, retention, context shifts, learning versions, conditional rules, and scope-precision checks. Those mechanisms are useful for keeping RealitySync honest, but exposing every mechanism as a separate product surface would turn the app into an analysis tool rather than the original scheduling experience.

Phase 15 therefore changes the product rule:

> **Advanced learning may support the original loop, but it must not become a second product.**

## Primary surface

The normal user flow remains only:

- **計画** — 理想のスケジュールを置く
- **記録** — 実際どうだったかを記録する
- **分析** — 理想と現実の違いを見る

The first demo remains the reference for hierarchy and vocabulary.

### Plan

Primary content:
- schedule time
- title
- category
- duration
- planned stress
- add/edit schedule

Secondary conveniences:
- previous-day copy
- templates

These conveniences are collapsed under **予定を楽に作る** so they do not compete with the schedule itself.

Advanced learning is allowed to return **at most one** visible planning suggestion:

> 前の記録からのヒント

The user sees the proposed plan change, not the experiment machinery that produced it.

### Record

The existing execution timeline remains the core:
- planned activity
- actual activity/status
- planned stress
- actual stress
- actual duration
- mood
- explicit record action

No Phase 15 complexity is added here.

### Analytics

Default analytics returns to the original demo hierarchy:

1. **理想の軌跡 vs 現実の歩み**
2. **予定の達成度サマリー**
3. **記録からの気づき** — at most one plain-language observation

Weekly and monthly views remain available only as a collapsed **週・月の振り返り** helper.

The following are no longer normal top-level product surfaces:
- Insight Candidate lists
- experiment management
- Retention panels
- Context Shift panels
- learning version history
- Scope Precision / Coverage panels
- weekly bulk optimization

Their underlying truth-preserving logic and stored data may remain in the codebase because they can support simple hints and protect historical correctness.

## Vocabulary rule

Normal UI should prefer:
- 前の記録からのヒント
- 記録からの気づき
- 予定はこう変わります
- この調整を予定へ反映

Normal UI should not require users to understand:
- Candidate
- Retention
- Context Shift
- Scope Precision
- Coverage
- Wilson interval
- learning version v1/v2/v3
- experiment failure rate

Those are implementation/research concepts, not product concepts.

## Automation boundary

RealitySync still does **not** automatically rewrite plans.

Advanced analysis may decide that a hint is eligible to show, but the user must still inspect the before/after preview and explicitly apply the change.

## Product guardrail for future phases

A future feature should only be added to the normal product surface if it directly improves one of these four steps:

1. make an ideal plan,
2. record reality truthfully,
3. understand the gap simply,
4. make the next plan slightly more realistic.

If a feature mainly explains the internal learning machinery, it should remain internal rather than becoming a new screen.

## Regression expectations

Phase 15 adds source-level product-surface tests to prevent accidental re-expansion:
- analytics must keep the original two core cards visible by default,
- technical insight screens must not be imported into the default analytics surface,
- plan view must not restore weekly optimization or learning badges,
- planning feedback must not expose experiment rates/trial counts,
- the main app flow remains Plan / Track / Analytics.
