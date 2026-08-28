import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('future weekly review is described as unobserved rather than planless', () => {
  const weekly = source('src/components/WeeklyAnalyticsView.jsx');
  assert.match(weekly, /startOfWeekDateKey\(selectedDate\) > dateKeyFromDate\(\)/);
  assert.match(weekly, /この週の現実はまだ観測前です/);
  assert.match(weekly, /保存済みの予定があっても「未記録」として数えません/);
});

test('future monthly review is described as unobserved rather than planless', () => {
  const monthly = source('src/components/MonthlyAnalyticsView.jsx');
  assert.match(monthly, /startOfMonthDateKey\(selectedDate\) > dateKeyFromDate\(\)/);
  assert.match(monthly, /この月の現実はまだ観測前です/);
  assert.match(monthly, /保存済みの予定があっても「未記録」として数えません/);
});
