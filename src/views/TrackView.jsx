import { AlertCircle, CheckCircle2, Frown, Meh, Smile, XCircle, Zap } from 'lucide-react';

export default function TrackView({ schedules, onRecord }) {
  return (
    <div className="space-y-6 pt-4 animate-in">
      <StressGraph schedules={schedules} />
      <section className="space-y-4">
        <h2 className="pl-1 text-lg font-bold text-gray-800">実行タイムライン</h2>
        <div className="relative ml-4 space-y-5 border-l-[3px] border-indigo-100 pb-4">
          {schedules.map((schedule) => {
            const isRecorded = schedule.status !== 'pending';
            return (
              <div key={schedule.id} className="relative pl-6">
                <div aria-hidden="true" className={`absolute -left-[11px] top-1 h-5 w-5 rounded-full border-[3px] border-white shadow-sm ${!isRecorded ? 'bg-indigo-300' : schedule.status === 'as_planned' ? 'bg-green-500' : schedule.status === 'changed' ? 'bg-orange-500' : 'bg-red-500'}`} />
                <div className="mb-1 text-sm font-bold text-indigo-600">{schedule.time}</div>
                <button type="button" onClick={() => onRecord(schedule)} className={`w-full cursor-pointer rounded-2xl border p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98] ${!isRecorded ? 'border-gray-100 bg-white' : schedule.status === 'as_planned' ? 'border-green-200 bg-green-50' : schedule.status === 'changed' ? 'border-orange-200 bg-orange-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="mb-2 flex items-start justify-between">
                    <div className={`font-bold ${schedule.status === 'skipped' ? 'text-gray-500' : 'text-gray-800'}`}>
                      <ActivityTitle schedule={schedule} isRecorded={isRecorded} />
                    </div>
                    {isRecorded && <Mood mood={schedule.mood} />}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3">
                    <div className="flex items-center gap-3">
                      <Metric label="想定負荷" value={schedule.plannedStress} className="text-gray-400" />
                      {isRecorded && <Metric label="実際の負荷" value={schedule.actualStress} className={schedule.actualStress > 80 ? 'text-red-500' : 'text-indigo-600'} />}
                    </div>
                    {!isRecorded ? <span className="rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-600">記録する</span> : <StatusIcon status={schedule.status} />}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ActivityTitle({ schedule, isRecorded }) {
  if (!isRecorded || schedule.status === 'as_planned') return schedule.title;
  if (schedule.status === 'skipped') return <span className="line-through">{schedule.title}</span>;
  return (
    <span className="flex flex-col">
      <span className="text-xs font-normal text-gray-400 line-through">{schedule.title}</span>
      <span>{schedule.actualTitle} <span className="text-[10px] font-normal text-orange-600">({schedule.actualCategory})</span></span>
    </span>
  );
}

function Mood({ mood }) {
  const Icon = mood === 'good' ? Smile : mood === 'bad' ? Frown : Meh;
  const className = mood === 'good' ? 'text-indigo-500' : mood === 'bad' ? 'text-red-400' : 'text-gray-400';
  return <span className="shrink-0 rounded-full border border-gray-100 bg-white px-2 py-0.5 shadow-sm"><Icon className={`h-4 w-4 ${className}`} /></span>;
}

function Metric({ label, value, className }) {
  return <span className="flex flex-col"><span className="text-[9px] font-bold uppercase text-gray-400">{label}</span><span className={`text-sm font-black ${className}`}>{value}</span></span>;
}

function StatusIcon({ status }) {
  const Icon = status === 'as_planned' ? CheckCircle2 : status === 'changed' ? AlertCircle : XCircle;
  const className = status === 'as_planned' ? 'text-green-500' : status === 'changed' ? 'text-orange-500' : 'text-red-500';
  return <span className="rounded-lg border border-gray-100 bg-white px-2 py-1 shadow-sm"><Icon className={`h-4 w-4 ${className}`} /></span>;
}

function StressGraph({ schedules }) {
  const width = 1000;
  const height = 240;
  const paddingX = 40;
  const paddingY = 40;
  const startHour = 6;
  const endHour = 24;
  const getX = (time) => paddingX + ((time - startHour) / (endHour - startHour)) * (width - paddingX * 2);
  const getY = (value) => height - paddingY - (value / 100) * (height - paddingY * 2);
  const sorted = [...schedules].sort((a, b) => a.timeValue - b.timeValue);
  const planned = sorted.map((schedule) => ({ x: getX(schedule.timeValue), y: getY(schedule.plannedStress) }));
  const recordedSchedules = sorted.filter((schedule) => schedule.status !== 'pending' && Number.isFinite(schedule.actualStress));
  const actual = recordedSchedules.map((schedule) => ({ x: getX(schedule.timeValue), y: getY(schedule.actualStress) }));
  const highStress = recordedSchedules.some((schedule) => schedule.actualStress > 80);
  const path = (points) => {
    if (!points.length) return '';
    return points.slice(1).reduce((d, point, index) => {
      const previous = points[index];
      const midX = (previous.x + point.x) / 2;
      return `${d} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
    }, `M ${points[0].x} ${points[0].y}`);
  };

  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      {highStress && <div className="absolute left-0 top-0 w-full border-b border-red-100 bg-red-50 py-1 text-center text-[10px] font-bold text-red-600">⚠️ 負荷80超えを記録しました。データが増えると、その後の行動との関係を分析できます。</div>}
      <div className={`mb-4 flex flex-col ${highStress ? 'mt-4' : ''}`}>
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-gray-800"><Zap className="h-4 w-4 text-indigo-500" />ストレス・負荷の波（計画 vs 現実）</h2>
        <div className="flex gap-4 text-[10px] font-bold"><span className="text-gray-400">--- 計画</span><span className="text-indigo-600">━ 現実</span></div>
      </div>
      <div className="relative w-full aspect-[2.5/1] overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label="計画と現実のストレス負荷推移">
          <defs><linearGradient id="actualLineGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#ec4899" /></linearGradient><linearGradient id="actualAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ec4899" stopOpacity="0.2" /><stop offset="100%" stopColor="#ec4899" stopOpacity="0" /></linearGradient></defs>
          {[25, 50, 75].map((value) => <line key={value} x1={paddingX} y1={getY(value)} x2={width - paddingX} y2={getY(value)} stroke="#f3f4f6" strokeWidth="2" />)}
          {[6, 9, 12, 15, 18, 21, 24].map((hour) => { const x = getX(hour); return <g key={hour}><line x1={x} y1={paddingY - 10} x2={x} y2={height - paddingY + 10} stroke="#f3f4f6" strokeWidth="2" strokeDasharray="4 4" /><text x={x} y={height - paddingY + 25} textAnchor="middle" fill="#9ca3af" fontSize="24" fontWeight="bold">{hour === 24 ? '0' : hour}</text></g>; })}
          {planned.length > 0 && <path d={path(planned)} fill="none" stroke="#cbd5e1" strokeWidth="4" strokeDasharray="8 8" strokeLinecap="round" />}
          {actual.length > 0 && <><path d={`${path(actual)} L ${actual.at(-1).x} ${height - paddingY} L ${actual[0].x} ${height - paddingY} Z`} fill="url(#actualAreaGradient)" /><path d={path(actual)} fill="none" stroke="url(#actualLineGradient)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></>}
          {planned.map((point, index) => <circle key={`p-${index}`} cx={point.x} cy={point.y} r="6" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="3" />)}
          {actual.map((point, index) => { const isHigh = recordedSchedules[index].actualStress > 80; return <g key={`a-${index}`}><circle cx={point.x} cy={point.y} r="8" fill="#fff" stroke={isHigh ? '#ef4444' : '#6366f1'} strokeWidth="4" />{isHigh && <circle cx={point.x} cy={point.y} r="14" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" className="animate-spin-slow" style={{ transformOrigin: `${point.x}px ${point.y}px` }} />}</g>; })}
        </svg>
      </div>
    </section>
  );
}
