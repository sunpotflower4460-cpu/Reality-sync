import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/constants.js';
import { buildWeeklyPlanFeedback } from '../src/utils/weeklyPlanningFeedback.js';

test('missing experiment rates stay unknown instead of becoming a synthetic zero-point improvement', () => {
  const experiment = {
    id: 'unknown-rates',
    candidateId: 'candidate',
    candidateType: 'category-outcome',
    title: 'Unknown evidence rates',
    hypothesis: '',
    action: '明示的な対策',
    metricKind: 'deviation',
    metricLabel: '変更・スキップ',
    condition: { kind: 'planned-category', value: '仕事' },
    startDateKey: '2026-08-01',
    targetRuns: 3,
    baselineFailureRate: null,
    baselineSampleCount: 0,
    planAdjustment: { kind: 'shorten-duration', minutes: 15 },
    status: 'completed',
    decision: 'adopt',
    decisionDateKey: '2026-08-24',
    trials: [],
    createdAt: '2026-08-01T00:00:00Z',
    completedAt: '2026-08-23T00:00:00Z',
  };
  const days = {
    '2026-08-24': [{
      id: 'work', time: '09:00', title: 'Work', category: '仕事', duration: 60, plannedStress: 50,
      status: STATUS.PENDING, appliedExperimentIds: [],
    }],
  };

  const weekly = buildWeeklyPlanFeedback([experiment], days, '2026-08-24', '2026-08-24');
  assert.equal(weekly.suggestions.length, 1);
  assert.equal(weekly.suggestions[0].improvementPoints, null);
  assert.equal(weekly.suggestions[0].preview.baselineFailureRate, null);
  assert.equal(weekly.suggestions[0].preview.experimentFailureRate, null);
});
