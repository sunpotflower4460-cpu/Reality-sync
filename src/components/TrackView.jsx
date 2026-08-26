import { AlertCircle, BellRing, CheckCircle2, Clock3, Frown, Meh, Smile, XCircle } from 'lucide-react';
import { MOOD, STATUS } from '../constants.js';
import { formatShortDateLabel } from '../utils/date.js';
import { sortSchedulesByTime } from '../utils/schedule.js';
import { StressGraph } from './StressGraph.jsx';

function MoodIcon({ mood }) {
  if (mood === MOOD.GOOD) return <Smile className="h-4 w-4 text-indigo-500" aria-label="気分: 良い" />;
  if (mood === MOOD.BAD) return <Frown className="h-4 w-4 text-rose-400" aria-label="気分: 疲れた" />;
  return <Meh className="h-4 w-4 text-slate-400" aria-label="気分: 普通" />;
}

function statusStyle(status) {
  if (status === STATUS.AS_PLANNED) return { accent: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', label: '予定通り' };
  if (status === STATUS.CHANGED) return { accent: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700', label: '変更' };
  if (status === STATUS.SKIPPED) return { accent: 'bg-rose-400', badge: 'bg-rose-50 text-rose-600', label: '休んだ' };
  return { accent: 'bg-indigo-300', badge: 'bg-slate-100 text-slate-500', label: '未記録' };
}

function TimelineTitle({ schedule, recorded }) {
  if (!recorded) return schedule.title;
  if (schedule.status === STATUS.CHANGED) {
    return <span className="flex flex-col"><span className="text-[9px] font-medium text-slate-400 line-through">{schedule.title}</span><span className="break-words">{schedule.actualTitle}<span className="ml-1 text-[9px] font-semibold text-amber-600">{schedule.actualCategory ? `・${schedule.actualCategory}` : ''}</span></span></span>;
  }
  if (schedule.status === STATUS.SKIPPED) return <span className="text-slate-500 line-through">{schedule.title}</span>;
  const recordedTitle = schedule.actualTitle || schedule.title;
  const recordedCategory = schedule.actualCategory || schedule.category;
  const planChangedAfterRecord = recordedTitle !== schedule.title || recordedCategory !== schedule.category;
  if (!planChangedAfterRecord) return schedule.title;
  return <span className="flex flex-col"><span className="text-[9px] font-medium text-slate-400">現在: {schedule.title}</span><span className="break-words">記録時: {recordedTitle}<span className="ml-1 text-[9px] font-semibold text-emerald-700">{recordedCategory ? `・${recordedCategory}` : ''}</span></span></span>;
}

export function TrackView({ schedules, dueSchedules = [], dateKey, onRecord }) {
  const orderedSchedules = sortSchedulesByTime(schedules);
  const firstDue = dueSchedules[0] ?? null;

  if (orderedSchedules.length === 0) {
    return (
      <div className="animate-fade-in pt-4">
        <section className="app-card-strong rounded-[1.55rem] p-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500"><Clock3 className="h-5 w-5" /></div>
          <h2 className="mt-4 text-base font-black text-slate-800">記録する予定がまだありません</h2>
          <p className="mx-auto mt-2 max-w-[17rem] text-xs leading-relaxed text-slate-500">計画タブで予定を置くと、ここに「予定と現実」のタイムラインができます。</p>
        </section>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4 pt-4">
      <div className="px-1">
        <p className="text-[9px] font-black tracking-[0.18em] text-indigo-500">REALITY</p>
        <h2 className="mt-1 text-[1.25rem] font-black tracking-tight text-slate-900">今日の現実</h2>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">できた・変えた・休んだを、そのまま残す</p>
      </div>

      {firstDue && (
        <button
          type="button"
          onClick={() => onRecord(firstDue)}
          className="flex w-full items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50/75 p-3 text-left transition hover:border-amber-300 active:scale-[0.99]"
          aria-label={`記録待ち ${dueSchedules.length}件。${firstDue.time} ${firstDue.title} を記録する`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm"><BellRing className="h-4 w-4" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black text-amber-900">記録待ち {dueSchedules.length}件</div>
            <p className="mt-0.5 truncate text-[10px] font-semibold text-amber-700">{firstDue.time} {firstDue.title}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[9px] font-extrabold text-white">記録</span>
        </button>
      )}

      <StressGraph schedules={orderedSchedules} dateKey={dateKey} />

      <section className="space-y-2.5" aria-labelledby="timeline-title">
        <div className="flex items-end justify-between gap-3 px-1">
          <div><h2 id="timeline-title" className="text-[15px] font-black text-slate-800">実行タイムライン</h2><p className="mt-0.5 text-[9px] text-slate-400">予定と、実際どうだったか</p></div>
          <span className="text-[10px] font-extrabold text-slate-400">{orderedSchedules.length}件</span>
        </div>

        <div className="relative ml-2.5 space-y-3 border-l border-indigo-100 pb-2">
          {orderedSchedules.map((schedule) => {
            const recorded = schedule.status !== STATUS.PENDING;
            const actualDateDiffers = schedule.actualStartDateKey && schedule.actualStartDateKey !== dateKey;
            const style = statusStyle(schedule.status);
            return (
              <article key={schedule.id} className="relative pl-4.5">
                <div className={`absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full ring-[3px] ring-[#f5f6fa] ${style.accent}`} aria-hidden="true" />
                <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold text-indigo-600">
                  <time dateTime={`${dateKey}T${schedule.time}`}>{schedule.time}</time>
                  {recorded && schedule.actualStartTime && schedule.status !== STATUS.SKIPPED && <><span className="text-slate-300">→</span><span className="flex items-center gap-1 text-pink-600"><Clock3 className="h-3 w-3" aria-hidden="true" />{actualDateDiffers ? `${formatShortDateLabel(schedule.actualStartDateKey)} ` : ''}{schedule.actualStartTime}</span></>}
                </div>

                <button type="button" onClick={() => onRecord(schedule)} className="app-card relative w-full overflow-hidden rounded-[1.2rem] p-3 text-left transition hover:shadow-[0_10px_28px_rgba(15,23,42,0.06)] active:scale-[0.99]" aria-label={`${schedule.time} ${schedule.title} の実績を${recorded ? '編集' : '記録'}する`}>
                  <span className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${style.accent}`} aria-hidden="true" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm font-black text-slate-800"><TimelineTitle schedule={schedule} recorded={recorded} /></div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {recorded && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50"><MoodIcon mood={schedule.mood} /></span>}
                      <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold ${style.badge}`}>{style.label}</span>
                    </div>
                  </div>

                  {recorded && schedule.status !== STATUS.SKIPPED && (!schedule.actualStartTime || !schedule.actualStartDateKey) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-bold">
                      {!schedule.actualStartTime && <span className="rounded-full bg-slate-50 px-2 py-1 text-slate-400">開始時刻なし</span>}
                      {schedule.actualStartTime && !schedule.actualStartDateKey && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-600">開始日不明</span>}
                    </div>
                  )}

                  {recorded && schedule.deviationReason && <p className="mt-2 line-clamp-2 border-l-2 border-slate-200 pl-2.5 text-[10px] leading-relaxed text-slate-500">{schedule.deviationReason}</p>}

                  <div className="mt-2.5 flex items-end justify-between gap-3 border-t border-slate-100 pt-2.5">
                    <div className="flex min-w-0 flex-wrap items-end gap-x-3.5 gap-y-2">
                      <Metric label="想定負荷" value={schedule.plannedStress} muted />
                      {recorded && <Metric label="実負荷" value={schedule.actualStress ?? '—'} danger={schedule.actualStress > 80} />}
                      {recorded && <Metric label="実時間" value={schedule.actualDuration === null ? '—' : `${schedule.actualDuration}分`} neutral />}
                    </div>
                    {!recorded && <span className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-[9px] font-extrabold text-white">記録</span>}
                    {recorded && <span className="shrink-0" aria-hidden="true">{schedule.status === STATUS.AS_PLANNED && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}{schedule.status === STATUS.CHANGED && <AlertCircle className="h-4 w-4 text-amber-500" />}{schedule.status === STATUS.SKIPPED && <XCircle className="h-4 w-4 text-rose-400" />}</span>}
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

function Metric({ label, value, muted = false, danger = false, neutral = false }) {
  const valueClass = danger ? 'text-rose-500' : neutral ? 'text-slate-700' : muted ? 'text-slate-400' : 'text-indigo-600';
  return <div className="flex flex-col"><span className="text-[8px] font-bold text-slate-400">{label}</span><span className={`text-[13px] font-black ${valueClass}`}>{value}</span></div>;
}
