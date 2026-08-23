import { STATUS } from '../constants.js';
import { differenceInCalendarDays, isValidDateKey, weekdayIndexMondayFirst } from './date.js';
import { exactStartDeltaMinutes } from './analytics.js';
import { normalizeSchedules } from './schedule.js';

export const INSIGHT_WINDOW_DAYS = 180;
export const LATE_START_THRESHOLD_MINUTES = 20;
const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];
const EVIDENCE_ORDER = { stable: 3, repeated: 2, emerging: 1 };

function roundPercent(value) {
  return Math.round(value * 100);
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function distinctMonthCount(rows) {
  return new Set(rows.map((row) => row.dateKey.slice(0, 7))).size;
}

export function wilsonInterval(successes, total, z = 1.96) {
  if (!Number.isFinite(successes) || !Number.isFinite(total) || total <= 0) return null;
  const safeSuccesses = Math.max(0, Math.min(total, successes));
  const p = safeSuccesses / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / denominator;
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}

function intervalsSeparated(left, right) {
  return left && right && (left.low > right.high || left.high < right.low);
}

function evidenceForComparison({ sampleCount, comparisonCount, monthCount, effectPoints, separated }) {
  const magnitude = Math.abs(effectPoints);
  if (sampleCount >= 12 && comparisonCount >= 20 && monthCount >= 3 && magnitude >= 20 && separated) {
    return 'stable';
  }
  if (sampleCount >= 8 && comparisonCount >= 12 && monthCount >= 2 && magnitude >= 15) {
    return 'repeated';
  }
  return 'emerging';
}

function evidenceLabel(evidence) {
  if (evidence === 'stable') return '比較的安定した観測';
  if (evidence === 'repeated') return '反復観測';
  return '探索中';
}

function createRateComparison({
  id,
  type,
  titleForDirection,
  hypothesisForDirection,
  groupRows,
  comparisonRows,
  success,
  groupLabel,
  comparisonLabel,
}) {
  if (groupRows.length < 4 || comparisonRows.length < 8) return null;
  const groupSuccesses = groupRows.filter(success).length;
  const comparisonSuccesses = comparisonRows.filter(success).length;
  const groupRate = groupSuccesses / groupRows.length;
  const comparisonRate = comparisonSuccesses / comparisonRows.length;
  const effectPoints = Math.round((groupRate - comparisonRate) * 100);
  if (Math.abs(effectPoints) < 15) return null;

  const groupInterval = wilsonInterval(groupSuccesses, groupRows.length);
  const comparisonInterval = wilsonInterval(comparisonSuccesses, comparisonRows.length);
  const monthCount = distinctMonthCount(groupRows);
  const separated = intervalsSeparated(groupInterval, comparisonInterval);
  const evidence = evidenceForComparison({
    sampleCount: groupRows.length,
    comparisonCount: comparisonRows.length,
    monthCount,
    effectPoints,
    separated,
  });
  const higher = effectPoints > 0;

  return {
    id,
    type,
    evidence,
    evidenceLabel: evidenceLabel(evidence),
    title: titleForDirection(higher, Math.abs(effectPoints)),
    observation: `${groupLabel}: ${groupSuccesses}/${groupRows.length}件 (${roundPercent(groupRate)}%) / ${comparisonLabel}: ${comparisonSuccesses}/${comparisonRows.length}件 (${roundPercent(comparisonRate)}%)`,
    comparison: `差 ${effectPoints > 0 ? '+' : ''}${effectPoints}pt。95% Wilson区間は ${groupLabel} ${roundPercent(groupInterval.low)}–${roundPercent(groupInterval.high)}%、${comparisonLabel} ${roundPercent(comparisonInterval.low)}–${roundPercent(comparisonInterval.high)}%。`,
    sampleCount: groupRows.length,
    comparisonCount: comparisonRows.length,
    monthCount,
    effectPoints,
    intervalsSeparated: separated,
    hypothesis: hypothesisForDirection(higher),
    caution: '関連の候補であり、原因を示すものではありません。期間・他条件・複数比較の影響が残ります。',
  };
}

function collectRecordedRows(days, anchorDateKey) {
  if (!days || typeof days !== 'object' || Array.isArray(days) || !isValidDateKey(anchorDateKey)) return [];
  const rows = [];

  for (const [dateKey, rawSchedules] of Object.entries(days)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(rawSchedules)) continue;
    const daysToAnchor = differenceInCalendarDays(dateKey, anchorDateKey);
    if (daysToAnchor === null || daysToAnchor < 0 || daysToAnchor >= INSIGHT_WINDOW_DAYS) continue;
    const weekdayIndex = weekdayIndexMondayFirst(dateKey);

    for (const schedule of normalizeSchedules(rawSchedules, [])) {
      if (schedule.status === STATUS.PENDING) continue;
      const hasSnapshot = Boolean(schedule.plannedSnapshot);
      let exactStartDelta = null;
      if (
        hasSnapshot
        && schedule.status !== STATUS.SKIPPED
        && schedule.actualStartDateKey
        && schedule.actualStartTime
      ) {
        exactStartDelta = exactStartDeltaMinutes(
          dateKey,
          schedule.plannedSnapshot.time,
          schedule.actualStartDateKey,
          schedule.actualStartTime,
        );
      }

      rows.push({
        dateKey,
        weekdayIndex,
        scheduleId: schedule.id,
        status: schedule.status,
        deviated: schedule.status === STATUS.CHANGED || schedule.status === STATUS.SKIPPED,
        hasSnapshot,
        plannedCategory: hasSnapshot ? schedule.plannedSnapshot.category : null,
        plannedStress: hasSnapshot ? schedule.plannedSnapshot.plannedStress : null,
        exactStartDelta,
        lateStart: exactStartDelta !== null ? exactStartDelta >= LATE_START_THRESHOLD_MINUTES : null,
        deviationReason: typeof schedule.deviationReason === 'string' && schedule.deviationReason.trim()
          ? schedule.deviationReason.trim()
          : null,
      });
    }
  }

  return rows.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

function weekdayOutcomeCandidates(rows) {
  const candidates = [];
  for (let index = 0; index < 7; index += 1) {
    const groupRows = rows.filter((row) => row.weekdayIndex === index);
    const comparisonRows = rows.filter((row) => row.weekdayIndex !== index);
    const label = `${WEEKDAY_LABELS[index]}曜`;
    const candidate = createRateComparison({
      id: `weekday-outcome-${index}`,
      type: 'weekday-outcome',
      groupRows,
      comparisonRows,
      success: (row) => row.deviated,
      groupLabel: label,
      comparisonLabel: '他曜日',
      titleForDirection: (higher, points) => `${label}の変更・スキップ率が他曜日より${points}pt${higher ? '高い' : '低い'}`,
      hypothesisForDirection: (higher) => higher
        ? `${label}の計画は、この観測期間では他曜日より崩れやすい可能性があります。曜日そのものが原因とは限りません。`
        : `${label}の計画は、この観測期間では他曜日より安定している可能性があります。曜日そのものが原因とは限りません。`,
    });
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function weekdayTimingCandidates(rows) {
  const timedRows = rows.filter((row) => row.exactStartDelta !== null);
  const candidates = [];
  for (let index = 0; index < 7; index += 1) {
    const groupRows = timedRows.filter((row) => row.weekdayIndex === index);
    const comparisonRows = timedRows.filter((row) => row.weekdayIndex !== index);
    const label = `${WEEKDAY_LABELS[index]}曜`;
    const candidate = createRateComparison({
      id: `weekday-late-${index}`,
      type: 'weekday-late-start',
      groupRows,
      comparisonRows,
      success: (row) => row.lateStart,
      groupLabel: label,
      comparisonLabel: '他曜日',
      titleForDirection: (higher, points) => `${label}の20分以上の開始遅れ率が他曜日より${points}pt${higher ? '高い' : '低い'}`,
      hypothesisForDirection: (higher) => higher
        ? `${label}には予定開始と実開始の間に、他曜日より大きなバッファが必要な可能性があります。`
        : `${label}は開始タイミングが他曜日より安定している可能性があります。`,
    });
    if (candidate) {
      candidate.observation += `。${label}の開始ズレ中央値は ${median(groupRows.map((row) => row.exactStartDelta))}分。`;
      candidates.push(candidate);
    }
  }
  return candidates;
}

function plannedStressCandidate(rows) {
  const snapshotRows = rows.filter((row) => row.hasSnapshot);
  const high = snapshotRows.filter((row) => row.plannedStress >= 70);
  const lower = snapshotRows.filter((row) => row.plannedStress < 70);
  if (high.length < 6 || lower.length < 6) return null;
  return createRateComparison({
    id: 'planned-stress-outcome',
    type: 'planned-stress-outcome',
    groupRows: high,
    comparisonRows: lower,
    success: (row) => row.deviated,
    groupLabel: '想定負荷70以上',
    comparisonLabel: '想定負荷70未満',
    titleForDirection: (higher, points) => `高めに見積もった予定の変更・スキップ率が${points}pt${higher ? '高い' : '低い'}`,
    hypothesisForDirection: (higher) => higher
      ? '高負荷と見積もった予定では、計画をそのまま実行しにくい条件が重なっている可能性があります。'
      : '高負荷と見積もった予定でも、この期間では変更・スキップが増えていない可能性があります。',
  });
}

function categoryOutcomeCandidates(rows) {
  const snapshotRows = rows.filter((row) => row.hasSnapshot);
  const categories = [...new Set(snapshotRows.map((row) => row.plannedCategory))];
  const candidates = [];
  for (const category of categories) {
    const groupRows = snapshotRows.filter((row) => row.plannedCategory === category);
    const comparisonRows = snapshotRows.filter((row) => row.plannedCategory !== category);
    if (groupRows.length < 5 || comparisonRows.length < 10) continue;
    const candidate = createRateComparison({
      id: `category-outcome-${category}`,
      type: 'category-outcome',
      groupRows,
      comparisonRows,
      success: (row) => row.deviated,
      groupLabel: category,
      comparisonLabel: '他カテゴリ',
      titleForDirection: (higher, points) => `${category}予定の変更・スキップ率が他カテゴリより${points}pt${higher ? '高い' : '低い'}`,
      hypothesisForDirection: (higher) => higher
        ? `${category}の予定には、他カテゴリより計画変更が起きやすい条件が含まれている可能性があります。`
        : `${category}の予定は、この期間では他カテゴリより安定している可能性があります。`,
    });
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function repeatedReasonCandidates(rows) {
  const reasonRows = rows.filter((row) => row.deviated && row.deviationReason);
  if (reasonRows.length < 5) return [];
  const groups = new Map();
  for (const row of reasonRows) {
    if (!groups.has(row.deviationReason)) groups.set(row.deviationReason, []);
    groups.get(row.deviationReason).push(row);
  }

  const candidates = [];
  for (const [reason, groupRows] of groups) {
    const share = groupRows.length / reasonRows.length;
    if (groupRows.length < 3 || share < 0.25) continue;
    const monthCount = distinctMonthCount(groupRows);
    const evidence = groupRows.length >= 8 && monthCount >= 3 && share >= 0.35
      ? 'stable'
      : groupRows.length >= 5 && monthCount >= 2
        ? 'repeated'
        : 'emerging';
    candidates.push({
      id: `reason-${reason}`,
      type: 'repeated-reason',
      evidence,
      evidenceLabel: evidenceLabel(evidence),
      title: `「${reason}」が変更・スキップ理由の${roundPercent(share)}%を占める`,
      observation: `理由付きの変更・スキップ ${reasonRows.length}件中 ${groupRows.length}件。${monthCount}か月で観測。`,
      comparison: '同じ文言で明示的に記録された理由だけを集計しています。似た意味の別表現は自動統合していません。',
      sampleCount: groupRows.length,
      comparisonCount: reasonRows.length,
      monthCount,
      effectPoints: roundPercent(share),
      intervalsSeparated: false,
      hypothesis: 'この理由は、次の計画改善で優先的に観測する価値がある繰り返しパターンかもしれません。',
      caution: '理由の入力粒度や言い回しに左右されます。理由が原因だったと統計的に証明するものではありません。',
    });
  }
  return candidates;
}

function insightReadiness(rows) {
  const snapshotRows = rows.filter((row) => row.hasSnapshot);
  const exactTimingRows = rows.filter((row) => row.exactStartDelta !== null);
  const reasonRows = rows.filter((row) => row.deviated && row.deviationReason);
  const months = distinctMonthCount(rows);
  const firstDate = rows[0]?.dateKey ?? null;
  const lastDate = rows.at(-1)?.dateKey ?? null;
  let stage = 'starting';
  if (rows.length >= 12 && months >= 2) stage = 'screening';
  else if (rows.length >= 4) stage = 'collecting';

  return {
    stage,
    recordedCount: rows.length,
    monthCount: months,
    snapshotCount: snapshotRows.length,
    snapshotCoverage: rows.length > 0 ? Math.round((snapshotRows.length / rows.length) * 100) : 0,
    exactTimingCount: exactTimingRows.length,
    reasonCount: reasonRows.length,
    firstDate,
    lastDate,
    windowDays: INSIGHT_WINDOW_DAYS,
  };
}

export function calculateLongitudinalInsights(days, anchorDateKey) {
  const rows = collectRecordedRows(days, anchorDateKey);
  const candidates = [
    ...weekdayOutcomeCandidates(rows),
    ...weekdayTimingCandidates(rows),
    plannedStressCandidate(rows),
    ...categoryOutcomeCandidates(rows),
    ...repeatedReasonCandidates(rows),
  ].filter(Boolean);

  candidates.sort((a, b) => {
    const evidenceDelta = EVIDENCE_ORDER[b.evidence] - EVIDENCE_ORDER[a.evidence];
    if (evidenceDelta !== 0) return evidenceDelta;
    const effectDelta = Math.abs(b.effectPoints) - Math.abs(a.effectPoints);
    if (effectDelta !== 0) return effectDelta;
    return b.sampleCount - a.sampleCount;
  });

  return {
    readiness: insightReadiness(rows),
    candidates: candidates.slice(0, 6),
    screenedCandidateCount: candidates.length,
    thresholds: {
      lateStartMinutes: LATE_START_THRESHOLD_MINUTES,
      plannedHighStress: 70,
      minimumGroupSamples: 4,
      minimumComparisonSamples: 8,
    },
  };
}
