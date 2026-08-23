import { AlertCircle, CheckCircle2, Clock3, Frown, Meh, Smile, XCircle } from 'lucide-react';
import { MOOD, STATUS } from '../constants.js';
import { formatShortDateLabel } from '../utils/date.js';
import { sortSchedulesByTime } from '../utils/schedule.js';
import { StressGraph } from './StressGraph.jsx';

function MoodIcon({ mood }) {
  if (mood === MOOD.GOOD) return <Smile className="h-4 w-4 text-indigo-500" aria-label="気分: 良い" />;
  if (mood === MOOD.BAD) return <Frown className="h-4 w-4 text-red-400" aria-label="気分: 疲れた" />;
  return <Meh className="h-4 w-4 text-gray-400" aria-label="気分: 普通" />;
}

function statusCardClass(status) {
  if (status === STATUS.AS_PLANNED) return 'border-green-200 bg-green-50';
  if (status === STATUS.CHANGED) return 'border-orange-200 bg-orange-50';
  if (status === STATUS.SKIPPED) return 'border-red-200 bg-red-50';
  return 'border-gray-100 bg-white';
}

function dotClass(status) {
  if (status === STATUS.AS_PLANNED) return 'bg-green-500';
  if (status === STATUS.CHANGED) return 'bg-orange-500';
  if (status === STATUS.SKIPPED) return 'bg-red-500';
  return 'bg-indigo-300';
}

function TimelineTitle({ schedule, recorded }) {
  if (!recorded) return schedule.title;
  if (schedule.status === STATUS.CHANGED) {
    return <span className="flex flex-col"><span className="text-xs font-normal text-gray-400 line-through">{schedule.title}</span><span className="break-words">{schedule.actualTitle}<span className="ml-1 text-[10px] font-normal text-orange-600">({schedule.actualCategory})</span></span></span>;
  }
  if (schedule.status === STATUS.SKIPPED) return <span className="line-through">{schedule.title}</span>;
  const recordedTitle = schedule.actualTitle || schedule.title;
  const recordedCategory = schedule.actualCategory || schedule.category;
  const planChangedAfterRecord = recordedTitle !== schedule.title || recordedCategory !== schedule.category;
  if (!planChangedAfterRecord) return schedule.title;
  return <span className="flex flex-col"><span className="text-[10px] font-normal text-gray-400">現在の予定: {schedule.title}</span><span className="break-words">記録時: {recordedTitle}<span className="ml-1 text-[10px] font-normal text-green-700">({recordedCategory})</span></span></span>;
}

export function TrackView({ schedules, dateKey, onRecord }) {
  const orderedSchedules = sortSchedulesByTime(schedules);

  if (orderedSchedules.length === 0) {
    return <div className="animate-fade-in pt-4"><section className="rounded-3xl border border-dashed border-indigo-200 bg-white p-8 text-center shadow-sm"><h2 className="mb-2 text-lg font-extrabold text-gray-800">この日はまだ予定がありません</h2><p className="text-sm leading-relaxed text-gray-500">計画タブで予定を置くと、ここに実行タイムラインと負荷の波が表示されます。</p></section></div>;
  }

  return (
    <div className="animate-fade-in space-y-6 pt-4">
      <StressGraph schedules={orderedSchedules} dateKey={dateKey} />
      <section className="space-y-4" aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="pl-1 text-lg font-bold text-gray-800">実行タイムライン</h2>
        <div className="relative ml-4 space-y-5 border-l-[3px] border-indigo-100 pb-4">
          {orderedSchedules.map((schedule) => {
            const recorded = schedule.status !== STATUS.PENDING;
            const actualDateDiffers = schedule.actualStartDateKey && schedule.actualStartDateKey !== dateKey;
            return (
              <article key={schedule.id} className="relative pl-6">
                <div className={`absolute -left-[11px] top-1 h-5 w-5 rounded-full border-[3px] border-white shadow-sm ${dotClass(schedule.status)}`} aria-hidden="true" />
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-bold text-indigo-600">
                  <time dateTime={`${dateKey}T${schedule.time}`}>予定 {schedule.time}</time>
                  {recorded && schedule.actualStartTime && schedule.status !== STATUS.SKIPPED && <><span className="text-gray-300">→</span><span className="flex items-center gap-1 text-pink-600"><Clock3 className="h-3.5 w-3.5" />実際 {actualDateDiffers ? `${formatShortDateLabel(schedule.actualStartDateKey)} ` : ''}{schedule.actualStartTime}</span></>}
                </div>
                <button type="button" onClick={() => onRecord(schedule)} className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md active:scale-[0.99] ${statusCardClass(schedule.status)}`} aria-label={`${schedule.time} ${schedule.title} の実績を${recorded ? '編集' : '記録'}する`}>
                  <div className="mb-2 flex items-start justify-between gap-3"><div className={`min-w-0 font-bold ${schedule.status === STATUS.SKIPPED ? 'text-gray-500' : 'text-gray-800'}`}><TimelineTitle schedule={schedule} recorded={recorded} /></div>{recorded && <span className="shrink-0 rounded-full border border-gray-100 bg-white px-2 py-0.5 shadow-sm"><MoodIcon mood={schedule.mood} /></span>}</div>
                  {recorded && !schedule.actualStartTime && schedule.status !== STATUS.SKIPPED && <p className="mb-2 text-[10px] font-medium text-gray-400">実際の開始日時は未記録</p>}
                  {recorded && schedule.actualStartTime && !schedule.actualStartDateKey && schedule.status !== STATUS.SKIPPED && <p className="mb-2 text-[10px] font-medium text-amber-600">開始時刻はありますが、開始日は旧記録のため不明です</p>}
                  {recorded && schedule.deviationReason && <p className="mb-3 rounded-lg bg-white/70 px-2.5 py-2 text-[10px] leading-relaxed text-gray-600"><span className="font-bold">理由:</span> {schedule.deviationReason}</p>}
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/5 pt-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="flex flex-col"><span className="text-[9px] font-bold uppercase text-gray-400">想定負荷</span><span className="text-sm font-black text-gray-400">{schedule.plannedStress}</span></div>
                      {recorded && <div className="flex flex-col"><span className="text-[9px] font-bold uppercase text-indigo-500">実際の負荷</span><span className={`text-sm font-black ${schedule.actualStress > 80 ? 'text-red-500' : 'text-indigo-600'}`}>{schedule.actualStress}</span></div>}
                      {recorded && <div className="flex flex-col"><span className="text-[9px] font-bold uppercase text-gray-400">実時間</span><span className="text-sm font-black text-gray-600">{schedule.actualDuration ?? 0}分</span></div>}
                    </div>
                    {!recorded ? <span className="shrink-0 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-600">記録する</span> : <span className="shrink-0 rounded-lg border border-gray-100 bg-white p-1.5 shadow-sm" aria-hidden="true">{schedule.status === STATUS.AS_PLANNED && <CheckCircle2 className="h-4 w-4 text-green-500" />}{schedule.status === STATUS.CHANGED && <AlertCircle className="h-4 w-4 text-orange-500" />}{schedule.status === STATUS.SKIPPED && <XCircle className="h-4 w-4 text-red-500" />}</span>}
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
