import { Zap } from 'lucide-react';
import { STATUS } from '../constants.js';
import { differenceInCalendarDays } from '../utils/date.js';
import { sortSchedulesByTime, timeToHours } from '../utils/schedule.js';

const WIDTH = 900;
const HEIGHT = 300;
const PADDING_X = 42;
const PADDING_Y = 52;
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
  const plannedHours = schedules.map((schedule) => timeToHours(schedule.time));
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
  const sorted = sortSchedulesByTime(schedules);
  const { startHour, endHour, gridHours, getX } = createTimeScale(sorted, dateKey);
  const plannedPoints = sorted.map((schedule) => ({ x: getX(timeToHours(schedule.time)), y: getY(schedule.plannedStress) }));
  const recorded = sorted.filter((schedule) => schedule.status !== STATUS.PENDING && Number.isFinite(schedule.actualStress));
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

  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-sm" aria-labelledby="stress-graph-title">
      {hasHighStress && <div className="-mx-5 -mt-5 mb-4 border-b border-red-100 bg-red-50 px-4 py-2 text-center text-[10px] font-bold text-red-600">⚠️ 負荷80超えの記録があります。前後の予定変更との関係を見てみましょう。</div>}
      <div className="mb-4 flex flex-col">
        <h2 id="stress-graph-title" className="mb-1 flex items-center gap-1.5 text-sm font-bold text-gray-800"><Zap className="h-4 w-4 text-indigo-500" aria-hidden="true" />ストレス・負荷の波（計画 vs 現実）</h2>
        <div className="flex gap-4 text-[10px] font-bold"><span className="flex items-center gap-1 text-gray-400"><span className="w-3 border-b border-dashed border-gray-400" />計画時刻</span><span className="flex items-center gap-1 text-indigo-600"><span className="h-1 w-3 rounded bg-indigo-500" />実際の開始日時</span></div>
        {(untimedCount > 0 || undatedCount > 0 || distantCount > 0) && <p className="mt-1.5 text-[9px] leading-relaxed text-gray-400">時間軸から除外: 開始時刻なし {untimedCount}件、開始日不明 {undatedCount}件、前後1日より遠い開始 {distantCount}件。計画時刻への推測配置はしていません。</p>}
      </div>
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" role="img" aria-label="計画時刻の想定負荷と、記録された実際の開始日時における負荷を比較する折れ線グラフ">
          <defs><linearGradient id="actualLineGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#ec4899" /></linearGradient><linearGradient id="actualAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ec4899" stopOpacity="0.2" /><stop offset="100%" stopColor="#ec4899" stopOpacity="0" /></linearGradient></defs>
          {[25, 50, 75].map((percent) => <line key={percent} x1={PADDING_X} y1={getY(percent)} x2={WIDTH - PADDING_X} y2={getY(percent)} stroke="#f3f4f6" strokeWidth="2" />)}
          {gridHours.map((hour) => { const x = PADDING_X + ((hour - startHour) / Math.max(endHour - startHour, 3)) * (WIDTH - PADDING_X * 2); return <g key={hour}><line x1={x} y1={PADDING_Y - 10} x2={x} y2={HEIGHT - PADDING_Y + 10} stroke="#f3f4f6" strokeWidth="2" strokeDasharray="4 4" /><text x={x} y={HEIGHT - 18} textAnchor="middle" fill="#9ca3af" fontSize="18" fontWeight="700">{formatAxisHour(hour)}</text></g>; })}
          {plannedPoints.length > 0 && <path d={plannedPath} fill="none" stroke="#cbd5e1" strokeWidth="4" strokeDasharray="8 8" strokeLinecap="round" />}
          {actualPoints.length > 1 && <path d={`${actualPath} L ${actualPoints.at(-1).x} ${HEIGHT - PADDING_Y} L ${actualPoints[0].x} ${HEIGHT - PADDING_Y} Z`} fill="url(#actualAreaGradient)" />}
          {actualPoints.length > 0 && <path d={actualPath} fill="none" stroke="url(#actualLineGradient)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />}
          {plannedPoints.map((point, index) => <circle key={`planned-${sorted[index].id}`} cx={point.x} cy={point.y} r="6" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="3" />)}
          {actualPoints.map((point, index) => <circle key={`actual-${actualTimed[index].schedule.id}`} cx={point.x} cy={point.y} r="8" fill="#fff" stroke={actualTimed[index].schedule.actualStress > 80 ? '#ef4444' : '#6366f1'} strokeWidth="4" />)}
        </svg>
      </div>
    </section>
  );
}
