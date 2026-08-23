import { getWeekDateKeys, isValidDateKey } from './date.js';
import { applyPlanFeedback, buildPlanFeedbackSuggestions } from './planningFeedback.js';

function cloneDays(days) {
  const source = days && typeof days === 'object' && !Array.isArray(days) ? days : {};
  return Object.fromEntries(Object.entries(source).map(([dateKey, schedules]) => [dateKey, Array.isArray(schedules) ? schedules.map((schedule) => ({ ...schedule })) : schedules]));
}

function improvementPoints(preview) {
  const baseline = Number(preview?.baselineFailureRate);
  const experiment = Number(preview?.experimentFailureRate);
  if (!Number.isFinite(baseline) || !Number.isFinite(experiment)) return null;
  return Math.round((baseline - experiment) * 1000) / 10;
}

function evidenceSort(left, right) {
  const leftTrials = Number(left.preview?.trialCount) || 0;
  const rightTrials = Number(right.preview?.trialCount) || 0;
  if (leftTrials !== rightTrials) return rightTrials - leftTrials;
  const leftImprovement = improvementPoints(left.preview) ?? -Infinity;
  const rightImprovement = improvementPoints(right.preview) ?? -Infinity;
  if (leftImprovement !== rightImprovement) return rightImprovement - leftImprovement;
  if (left.dateKey !== right.dateKey) return left.dateKey.localeCompare(right.dateKey);
  const leftTime = left.preview?.before?.time ?? '99:99';
  const rightTime = right.preview?.before?.time ?? '99:99';
  if (leftTime !== rightTime) return leftTime.localeCompare(rightTime);
  return left.id.localeCompare(right.id);
}

function calendarSort(left, right) {
  if (left.dateKey !== right.dateKey) return left.dateKey.localeCompare(right.dateKey);
  const leftTime = left.preview?.before?.time ?? '99:99';
  const rightTime = right.preview?.before?.time ?? '99:99';
  if (leftTime !== rightTime) return leftTime.localeCompare(rightTime);
  return (left.evidenceOrder ?? Number.MAX_SAFE_INTEGER) - (right.evidenceOrder ?? Number.MAX_SAFE_INTEGER);
}

function sameTargetKey(suggestion) {
  return `${suggestion.dateKey}::${String(suggestion.scheduleId)}`;
}

export function buildWeeklyPlanFeedback(experiments, days, anchorDateKey, todayDateKey) {
  if (!isValidDateKey(anchorDateKey) || !isValidDateKey(todayDateKey)) {
    return { anchorDateKey, dateKeys: [], suggestions: [], actionableCount: 0, guidanceCount: 0, multipleTargetGroups: [] };
  }

  const dateKeys = getWeekDateKeys(anchorDateKey);
  const suggestions = [];

  for (const dateKey of dateKeys) {
    if (dateKey < todayDateKey) continue;
    const daySuggestions = buildPlanFeedbackSuggestions(experiments, dateKey, days?.[dateKey] ?? []);
    for (const suggestion of daySuggestions) {
      suggestions.push({
        ...suggestion,
        dateKey,
        improvementPoints: improvementPoints(suggestion.preview),
      });
    }
  }

  const evidenceOrdered = [...suggestions].sort(evidenceSort);
  evidenceOrdered.forEach((suggestion, index) => { suggestion.evidenceOrder = index + 1; });
  suggestions.sort(calendarSort);

  const targetGroups = new Map();
  for (const suggestion of suggestions.filter((item) => item.preview?.canApply)) {
    const key = sameTargetKey(suggestion);
    const group = targetGroups.get(key) ?? [];
    group.push(suggestion.id);
    targetGroups.set(key, group);
  }
  const multipleTargetGroups = [...targetGroups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([targetKey, suggestionIds]) => ({ targetKey, suggestionIds }));

  return {
    anchorDateKey,
    dateKeys,
    suggestions,
    actionableCount: suggestions.filter((item) => item.preview?.canApply).length,
    guidanceCount: suggestions.filter((item) => !item.preview?.canApply).length,
    multipleTargetGroups,
  };
}

export function simulateWeeklyPlanFeedback(experiments, days, weeklyPlan, selectedSuggestionIds, idFactory = (_, index) => `weekly-preview-${index + 1}`) {
  const selectedIds = new Set(Array.isArray(selectedSuggestionIds) ? selectedSuggestionIds : []);
  const selected = (weeklyPlan?.suggestions ?? []).filter((suggestion) => selectedIds.has(suggestion.id));
  if (selected.length === 0) {
    return { ok: false, error: '反映する工夫を1件以上選んでください。', conflicts: [], selectedCount: 0, applied: [], days: cloneDays(days) };
  }

  const nonApplicable = selected.filter((suggestion) => !suggestion.preview?.canApply);
  if (nonApplicable.length > 0) {
    return {
      ok: false,
      error: '参考表示だけの工夫が選択されています。構造化された変更だけを週一括反映できます。',
      conflicts: nonApplicable.map((suggestion) => ({ suggestionId: suggestion.id, message: suggestion.preview?.error ?? 'この工夫は一括反映できません。' })),
      selectedCount: selected.length,
      applied: [],
      days: cloneDays(days),
    };
  }

  const byTarget = new Map();
  for (const suggestion of selected) {
    const key = sameTargetKey(suggestion);
    const group = byTarget.get(key) ?? [];
    group.push(suggestion);
    byTarget.set(key, group);
  }
  const sameTargetConflicts = [...byTarget.values()].filter((group) => group.length > 1);
  if (sameTargetConflicts.length > 0) {
    return {
      ok: false,
      error: '同じ予定に複数の工夫が選ばれています。週一括では順序を自動決定しないため、同じ予定は1つだけ選んでください。',
      conflicts: sameTargetConflicts.flatMap((group) => group.map((suggestion) => ({ suggestionId: suggestion.id, message: '同じ予定に複数の変更候補があります。' }))),
      selectedCount: selected.length,
      applied: [],
      days: cloneDays(days),
    };
  }

  const experimentById = new Map((Array.isArray(experiments) ? experiments : []).map((experiment) => [experiment.id, experiment]));
  const workingDays = cloneDays(days);
  const applied = [];
  const ordered = [...selected].sort(calendarSort);

  for (let index = 0; index < ordered.length; index += 1) {
    const suggestion = ordered[index];
    const experiment = experimentById.get(suggestion.experimentId);
    if (!experiment) {
      return {
        ok: false,
        error: '採用済み実験を確認できない工夫があります。データを再読み込みしてください。',
        conflicts: [{ suggestionId: suggestion.id, message: '実験データが見つかりません。' }],
        selectedCount: selected.length,
        applied: [],
        days: cloneDays(days),
      };
    }

    const currentDay = Array.isArray(workingDays[suggestion.dateKey]) ? workingDays[suggestion.dateKey] : [];
    const newScheduleId = idFactory(suggestion, index);
    const result = applyPlanFeedback(experiment, suggestion.dateKey, currentDay, suggestion.scheduleId, newScheduleId);
    if (!result.ok) {
      return {
        ok: false,
        error: '選択した工夫どうし、または既存予定との競合があります。自動では優先順位を決めないため、選択を減らして再確認してください。',
        conflicts: [{ suggestionId: suggestion.id, message: result.error ?? 'この組み合わせは反映できません。' }],
        selectedCount: selected.length,
        applied: [],
        days: cloneDays(days),
      };
    }

    workingDays[suggestion.dateKey] = result.schedules;
    applied.push({
      suggestionId: suggestion.id,
      experimentId: suggestion.experimentId,
      dateKey: suggestion.dateKey,
      scheduleId: suggestion.scheduleId,
      adjustmentLabel: suggestion.preview?.adjustmentLabel ?? '',
    });
  }

  return {
    ok: true,
    error: '',
    conflicts: [],
    selectedCount: selected.length,
    applied,
    days: workingDays,
  };
}

export function applyWeeklyPlanFeedback(experiments, days, weeklyPlan, selectedSuggestionIds, idFactory) {
  return simulateWeeklyPlanFeedback(experiments, days, weeklyPlan, selectedSuggestionIds, idFactory);
}
