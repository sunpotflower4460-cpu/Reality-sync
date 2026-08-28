import { STATUS } from '../constants.js';
import { contextRuleLabel } from './contextRule.js';
import { isValidDateKey } from './date.js';
import {
  buildLearningLineages,
  calculateExperimentResult,
  EXPERIMENT_DECISION,
  EXPERIMENT_STATUS,
  experimentMatchesSchedule,
  normalizeExperiment,
  PLAN_ADJUSTMENT_KIND,
  planAdjustmentLabel,
} from './experiment.js';
import { normalizeSchedules } from './schedule.js';

const MAX_APPLIED_EXPERIMENT_IDS = 50;

function timeToMinutes(time) {
  if (typeof time !== 'string') return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) return null;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function intervalFor(schedule, override = {}) {
  const start = timeToMinutes(override.time ?? schedule.time);
  const duration = Number(override.duration ?? schedule.duration);
  if (start === null || !Number.isFinite(duration) || duration < 0) return null;
  const end = start + duration;
  if (end > 1440) return null;
  return { start, end };
}

function overlaps(left, right) {
  return Boolean(left && right && left.start < right.end && right.start < left.end);
}

function conflictsWithOtherSchedules(schedules, targetId, interval) {
  if (!interval) return null;
  for (const schedule of schedules) {
    if (String(schedule.id) === String(targetId)) continue;
    const other = intervalFor(schedule);
    if (overlaps(interval, other)) return schedule;
  }
  return null;
}

function canAddExperimentMarker(schedule, experimentId) {
  const ids = Array.isArray(schedule?.appliedExperimentIds) ? schedule.appliedExperimentIds : [];
  return ids.includes(experimentId) || ids.length < MAX_APPLIED_EXPERIMENT_IDS;
}

function addExperimentMarker(schedule, experimentId) {
  const ids = Array.isArray(schedule.appliedExperimentIds) ? schedule.appliedExperimentIds : [];
  if (ids.includes(experimentId)) return schedule;
  if (ids.length >= MAX_APPLIED_EXPERIMENT_IDS) return null;
  return { ...schedule, appliedExperimentIds: [...ids, experimentId] };
}

function pendingPlan(id, time, title, category, duration, plannedStress, appliedExperimentIds = []) {
  return {
    id,
    time,
    title,
    category,
    duration,
    plannedStress,
    appliedExperimentIds,
    status: STATUS.PENDING,
    plannedSnapshot: null,
    actualTitle: '',
    actualCategory: null,
    actualDuration: null,
    actualStartTime: null,
    actualStartDateKey: null,
    deviationReason: null,
    mood: null,
    actualStress: null,
  };
}

function feedbackAllowedOnDate(experiment, dateKey) {
  return !experiment.decisionDateKey || dateKey >= experiment.decisionDateKey;
}

export function adoptedExperiments(experiments) {
  return buildLearningLineages(experiments).flatMap((lineage) => {
    const current = [...lineage.versions].reverse().find((experiment) => (
      experiment.status === EXPERIMENT_STATUS.COMPLETED
      && experiment.decision === EXPERIMENT_DECISION.ADOPT
    ));
    return current ? [current] : [];
  });
}

export function createPlanFeedbackPreview(experimentValue, dateKey, schedulesValue, scheduleId) {
  const experiment = normalizeExperiment(experimentValue);
  const schedules = normalizeSchedules(schedulesValue, []);
  const schedule = schedules.find((item) => String(item.id) === String(scheduleId));
  if (!experiment || !isValidDateKey(dateKey) || !schedule) return { canApply: false, error: '対象の予定を確認できません。' };
  if (experiment.status !== EXPERIMENT_STATUS.COMPLETED || experiment.decision !== EXPERIMENT_DECISION.ADOPT) {
    return { canApply: false, error: '採用済みの実験ではありません。' };
  }
  if (experiment.decisionDateKey && dateKey < experiment.decisionDateKey) {
    return { canApply: false, error: 'この予定は実験を採用する前の日付です。過去へ遡って学習結果を適用しません。' };
  }
  if (schedule.status !== STATUS.PENDING) return { canApply: false, error: '実績がある予定は、過去を書き換えないため変更できません。' };
  if (!experimentMatchesSchedule(experiment, dateKey, schedule, schedules)) return { canApply: false, error: 'この予定は採用した実験条件または条件付きルールに一致しません。' };
  if (schedule.appliedExperimentIds.includes(experiment.id)) return { canApply: false, error: 'この予定にはすでに同じ工夫が反映されています。' };
  if (!canAddExperimentMarker(schedule, experiment.id)) {
    return { canApply: false, error: 'この予定には適用済みの工夫が多すぎるため、追加の自動変更は行いません。予定を作り直すか、手動で調整してください。' };
  }

  const result = calculateExperimentResult(experiment);
  const base = {
    experimentId: experiment.id,
    scheduleId: schedule.id,
    experimentTitle: experiment.title,
    action: experiment.action,
    contextRuleLabel: experiment.contextRule ? contextRuleLabel(experiment.contextRule) : null,
    adjustmentLabel: planAdjustmentLabel(experiment.planAdjustment),
    baselineFailureRate: result?.baselineFailureRate ?? null,
    experimentFailureRate: result?.failureRate ?? null,
    trialCount: result?.trialCount ?? 0,
    before: { time: schedule.time, title: schedule.title, duration: schedule.duration, category: schedule.category, plannedStress: schedule.plannedStress },
  };

  const adjustment = experiment.planAdjustment;
  if (!adjustment || !experiment.decisionDateKey) {
    return {
      ...base,
      kind: 'guidance-only',
      canApply: false,
      error: !adjustment
        ? 'この実験はPhase 7以前の自由記述対策、または「ガイダンスのみ」です。文章から変更内容を推測せず、対策文だけを参考表示します。'
        : 'この実験は正確な採用日を持たない旧データです。過去へ遡る可能性を避けるため、自動適用せず参考表示だけにします。',
      after: null,
    };
  }

  if (adjustment.kind === PLAN_ADJUSTMENT_KIND.BUFFER_BEFORE) {
    const start = timeToMinutes(schedule.time);
    if (start === null || start - adjustment.minutes < 0) {
      return { ...base, kind: adjustment.kind, canApply: false, error: '余白を置くと前日へ跨ぐため、この日の予定には自動適用できません。', after: null };
    }
    const bufferStart = start - adjustment.minutes;
    const bufferInterval = { start: bufferStart, end: start };
    const conflict = conflictsWithOtherSchedules(schedules, schedule.id, bufferInterval);
    if (conflict) {
      return { ...base, kind: adjustment.kind, canApply: false, error: `余白の時間帯が「${conflict.title}」と重なります。先に予定を調整してください。`, after: null };
    }
    return {
      ...base,
      kind: adjustment.kind,
      canApply: true,
      after: { ...base.before },
      inserted: {
        time: minutesToTime(bufferStart),
        title: '調整バッファ',
        category: '休憩',
        duration: adjustment.minutes,
        plannedStress: 0,
      },
    };
  }

  if (adjustment.kind === PLAN_ADJUSTMENT_KIND.SHORTEN_DURATION) {
    const nextDuration = schedule.duration - adjustment.minutes;
    if (nextDuration < 5) {
      return { ...base, kind: adjustment.kind, canApply: false, error: '短縮後が5分未満になるため、自動適用できません。', after: null };
    }
    return {
      ...base,
      kind: adjustment.kind,
      canApply: true,
      after: { ...base.before, duration: nextDuration },
    };
  }

  if (adjustment.kind === PLAN_ADJUSTMENT_KIND.SHIFT_START_LATER) {
    const start = timeToMinutes(schedule.time);
    if (start === null) return { ...base, kind: adjustment.kind, canApply: false, error: '開始時刻を確認できません。', after: null };
    const shiftedStart = start + adjustment.minutes;
    const shiftedTime = minutesToTime(shiftedStart);
    const shiftedInterval = shiftedTime ? intervalFor(schedule, { time: shiftedTime }) : null;
    if (!shiftedInterval) {
      return { ...base, kind: adjustment.kind, canApply: false, error: '開始を後ろへずらすと日付を跨ぐため、自動適用できません。', after: null };
    }
    const conflict = conflictsWithOtherSchedules(schedules, schedule.id, shiftedInterval);
    if (conflict) {
      return { ...base, kind: adjustment.kind, canApply: false, error: `変更後の予定が「${conflict.title}」と重なります。先に予定を調整してください。`, after: null };
    }
    return {
      ...base,
      kind: adjustment.kind,
      canApply: true,
      after: { ...base.before, time: shiftedTime },
    };
  }

  return { ...base, canApply: false, error: 'この変更形式にはまだ対応していません。', after: null };
}

export function buildPlanFeedbackSuggestions(experimentsValue, dateKey, schedulesValue) {
  if (!isValidDateKey(dateKey)) return [];
  const schedules = normalizeSchedules(schedulesValue, []);
  const experiments = adoptedExperiments(experimentsValue);
  const suggestions = [];

  for (const experiment of experiments) {
    if (!feedbackAllowedOnDate(experiment, dateKey)) continue;
    for (const schedule of schedules) {
      if (schedule.status !== STATUS.PENDING) continue;
      if (schedule.appliedExperimentIds.includes(experiment.id)) continue;
      if (!experimentMatchesSchedule(experiment, dateKey, schedule, schedules)) continue;
      suggestions.push({
        id: `${experiment.id}::${String(schedule.id)}`,
        experimentId: experiment.id,
        scheduleId: schedule.id,
        preview: createPlanFeedbackPreview(experiment, dateKey, schedules, schedule.id),
      });
    }
  }

  return suggestions;
}

export function applyPlanFeedback(experimentValue, dateKey, schedulesValue, scheduleId, newScheduleId) {
  const experiment = normalizeExperiment(experimentValue);
  const schedules = normalizeSchedules(schedulesValue, []);
  const preview = createPlanFeedbackPreview(experiment, dateKey, schedules, scheduleId);
  if (!preview.canApply || !experiment) return { ok: false, error: preview.error || '変更を適用できません。', schedules };

  if (preview.kind === PLAN_ADJUSTMENT_KIND.BUFFER_BEFORE) {
    if (!newScheduleId) return { ok: false, error: '新しい予定IDを作成できませんでした。', schedules };
    if (schedules.some((schedule) => String(schedule.id) === String(newScheduleId))) {
      return { ok: false, error: '新しい予定IDが既存予定と重複したため、変更を適用しませんでした。', schedules };
    }
    const next = schedules.map((schedule) => {
      if (String(schedule.id) !== String(scheduleId)) return schedule;
      return addExperimentMarker(schedule, experiment.id) ?? schedule;
    });
    next.push(pendingPlan(
      newScheduleId,
      preview.inserted.time,
      preview.inserted.title,
      preview.inserted.category,
      preview.inserted.duration,
      preview.inserted.plannedStress,
      [experiment.id],
    ));
    return { ok: true, schedules: next };
  }

  const next = schedules.map((schedule) => {
    if (String(schedule.id) !== String(scheduleId)) return schedule;
    const marked = addExperimentMarker(schedule, experiment.id);
    if (!marked) return schedule;
    if (preview.kind === PLAN_ADJUSTMENT_KIND.SHORTEN_DURATION) return { ...marked, duration: preview.after.duration };
    if (preview.kind === PLAN_ADJUSTMENT_KIND.SHIFT_START_LATER) return { ...marked, time: preview.after.time };
    return marked;
  });
  return { ok: true, schedules: next };
}
