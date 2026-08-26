import { Info, Zap } from 'lucide-react';
import { STATUS } from '../constants.js';
import { differenceInCalendarDays } from '../utils/date.js';
import { recordedPlanForSchedule, timeToHours } from '../utils/schedule.js';

const WIDTH = 900;
const HEIGHT = 250;
const PADDING_X = 40;
const PADDING_Y = 42;
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 24;

function actualAxisHour(schedule, dateKey) {
  if (!schedule.actualStartTime || !schedule.actualStartDateKey) return null;
  const dayOffset = differenceInCalendarDays(dateKey, schedule.actualStartDateKey);
  if (dayOffset === null || Math.abs(dayOffset) > 1) return null;
  return dayOffset * 24 + timeToHours(schedule.actualStartTime);
}

function formatAxisHour(value) {
  const rounded = Math.round(value);
  const dayOffset = Math.floor(rounded / 24);
  const hour = ((rounded % 24) + 24) % 24;
  if (dayOffset === -1) return `前 ${hour}`;
  if (dayOffset === 1) return `翌 ${hour}`;
  return String(hour);
}

function createTimeScale(schedules, dateKey) {
  const plannedHours = schedules.map((schedule) => timeToHours(recordedPlanForSchedule(schedule).time));
  const actualHours = schedules.map((schedule) => actualAxisHour(schedule, dateKey)).filter(Number.isFinite);
  const values = [...plannedHours, ...actualHours];
  const minValue = values.length > 0 ? Math.min(...values) : DEFAULT_START_HOUR;
  const maxValue = values.length > 0 ? Math.max(...values) : DEFAULT_END_HOUR;
  const startHour = minValue < 0 ? Math.floor(minValue / 3) * 3 : (minValue < DEFAULT_START_HOUR ? 0 : DEFAULT_START_HOUR);
  const endHour = maxValue > DEFAULT_END_HOUR ? Math.ceil(maxValue / 3) * 3 : DEFAULT_END_HOUR;
  const span = Math.max(endHour - startHour, 3);
  const gridHours = [];
  for (let hour = startHour; hour <= endHour; hour += 3) gridHours.push(hour);
  const getX = (hour) => PADDING_X + ((hour - startHour) / span) * (WIDTH - PADDING_X * 2);
  return { startHour, endHour, gridHours, getX };
}

function getY(value) {
  return HEIGHT - PADDING_Y - (value / 100) * (HEIGHT - PADDING_Y * 2);
}

function generateSmoothPath(points) {
  if (points.length === 0) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midpointX = (previous.x + current.x) / 2;
    path += ` C ${midpointX} ${previous.y}, ${midpointX} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

export function StressGraph({ schedules, dateKey }) {
  const plannedSorted = [...schedules].sort((a, b) => timeToHours(recordedPlanForSchedule(a).time) - timeToHours(recordedPlanForSchedule(b).time));
  const { startHour, endHour, gridHours, getX } = createTimeScale(plannedSorted, dateKey);
  const plannedPoints = plannedSorted.map((schedule) => {
    const planned = recordedPlanForSchedule(schedule);
    return { x: getX(timeToHours(planned.time)), y: getY(planned.plannedStress) };
  });
  const recorded = schedules.filter((schedule) => schedule.status !== STATUS.PENDING && Number.isFinite(schedule.actualStress));
  const legacyPlanCount = recorded.filter((schedule) => !schedule.plannedSnapshot).length;
  const actualTimed = recorded
    .map((schedule) => ({ schedule, axisHour: schedule.status === STATUS.SKIPPED ? null : actualAxisHour(schedule, dateKey) }))
    .filter((entry) => Number.isFinite(entry.axisHour))
    .sort((a, b) => a.axisHour - b.axisHour);
  const actualPoints = actualTimed.map(({ schedule, axisHour }) => ({ x: getX(axisHour), y: getY(schedule.actualStress) }));
  const plannedPath = generateSmoothPath(plannedPoints);
  const actualPath = generateSmoothPath(actualPoints);
  const hasHighStress = recorded.some((schedule) => schedule.actualStress > 80);
  const activeRecorded = recorded.filter((schedule) => schedule.status !== STATUS.SKIPPED);
  const untimedCount = activeRecorded.filter((schedule) => !schedule.actualStartTime).length;
  const undatedCount = activeRecorded.filter((schedule) => schedule.actualStartTime && !schedule.actualStartDateKey).length;
  const distantCount = activeRecorded.filter((schedule) => {
    if (!schedule.actualStartTime || !schedule.actualStartDateKey) return false;
    const offset = differenceInCalendarDays(dateKey, schedule.actualStartDateKey);
    return offset !== null && Math.abs(offset) > 1;
  }).length;
  const hasDisplayNotes = legacyPlanCount > 0 || untimedCount > 0 || undatedCount > 0 || distantCount > 0;

  return (
    <section className="app-card overflow-hidden rounded-[1.3rem]" aria-labelledby="stress-graph-title">
      {hasHighStress && <div className="border-b border-red-100 bg-red-50 px-3.5 py-2 text-center text-[9px] font-bold text-red-600">負荷80超えの記録があります。前後の流れも一緒に見てみましょう。</div>}
      <div className="p-3.5 pb-2.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="stress-graph-title" className="flex items-center gap-1.5 text-[13px] font-extrabold text-slate-800"><Zap className="h-4 w-4 text-indigo-500" aria-hidden="true" />負荷の波</h2>
            <p className="mt-0.5 text-[9px] text-slate-400">予定していた負荷と、実際の負荷</p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5 text-[8px] font-bold">
            <span className="flex items-center gap-1 text-slate-400"><span className="w-3 border-b border-dashed border-slate-400" />予定</span>
            <span className="flex items-center gap-1 text-indigo-600"><span className="h-1 w-3 rounded bg-indigo-500" />実際</span>
          </div>
        </div>

        <div className="mt-2 w-full overflow-hidden" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" role="img" aria-label="記録時の計画を優先した負荷と、記録された実際の開始日時における負荷を比較する折れ線グラフ">
            <defs><linearGradient id="actualLineGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#ec4899" /></linearGradient><linearGradient id="actualAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ec4899" stopOpacity="0.16" /><stop offset="100%" stopColor="#ec4899" stopOpacity="0" /></linearGradient></defs>
            {[25, 50, 75].map((percent) => <line key={percent} x1={PADDING_X} y1={getY(percent)} x2={WIDTH - PADDING_X} y2={getY(percent)} stroke="#f1f5f9" strokeWidth="2" />)}
            {gridHours.map((hour) => { const x = PADDING_X + ((hour - startHour) / Math.max(endHour - startHour, 3)) * (WIDTH - PADDING_X * 2); return <g key={hour}><line x1={x} y1={PADDING_Y - 8} x2={x} y2={HEIGHT - PADDING_Y + 8} stroke="#f1f5f9" strokeWidth="2" strokeDasharray="4 4" /><text x={x} y={HEIGHT - 13} textAnchor="middle" fill="#94a3b8" fontSize="17" fontWeight="700">{formatAxisHour(hour)}</text></g>; })}
            {plannedPoints.length > 0 && <path d={plannedPath} fill="none" stroke="#cbd5e1" strokeWidth="4" strokeDasharray="8 8" strokeLinecap="round" />}
            {actualPoints.length > 1 && <path d={`${actualPath} L ${actualPoints.at(-1).x} ${HEIGHT - PADDING_Y} L ${actualPoints[0].x} ${HEIGHT - PADDING_Y} Z`} fill="url(#actualAreaGradient)" />}
            {actualPoints.length > 0 && <path d={actualPath} fill="none" stroke="url(#actualLineGradient)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />}
            {plannedPoints.map((point, index) => <circle key={`planned-${plannedSorted[index].id}`} cx={point.x} cy={point.y} r="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="3" />)}
            {actualPoints.map((point, index) => <circle key={`actual-${actualTimed[index].schedule.id}`} cx={point.x} cy={point.y} r="8" fill="#fff" stroke={actualTimed[index].schedule.actualStress > 80 ? '#ef4444' : '#6366f1'} strokeWidth="4" />)}
          </svg>
        </div>

        {recorded.length > 0 && actualPoints.length === 0 && <p className="mt-1 text-center text-[9px] leading-relaxed text-slate-400">実際の開始日時を記録すると、現実の線も時間軸に表示されます。</p>}
      </div>

      {hasDisplayNotes && (
        <details className="border-t border-slate-100 bg-slate-50/70">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3.5 py-2 text-[9px] font-bold text-slate-400"><Info className="h-3.5 w-3.5" aria-hidden="true" />表示について</summary>
          <div className="space-y-1.5 px-3.5 pb-3 text-[9px] leading-relaxed text-slate-400">
            {legacyPlanCount > 0 && <p>記録時の予定が残っていない旧実績 {legacyPlanCount}件では、現在の予定を参考表示しています。過去の予定を推測して復元してはいません。</p>}
            {(untimedCount > 0 || undatedCount > 0 || distantCount > 0) && <p>現実の時間軸から除外: 開始時刻なし {untimedCount}件、開始日不明 {undatedCount}件、前後1日より遠い開始 {distantCount}件。予定時刻への推測配置はしていません。</p>}
          </div>
        </details>
      )}
    </section>
  );
}
