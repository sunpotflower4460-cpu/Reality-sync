import { BellRing, ChevronRight, Clock3, Frown, Meh, Smile } from 'lucide-react';
import { MOOD, STATUS } from '../constants.js';
import { formatShortDateLabel, isToday } from '../utils/date.js';
import { recordedPlanForSchedule, timeToHours } from '../utils/schedule.js';
import { StressGraph } from './StressGraph.jsx';

function MoodIcon({ mood }) {
  if (mood === MOOD.GOOD) return <Smile className="h-4 w-4 text-indigo-500" aria-label="気分: 良い" />;
  if (mood === MOOD.NORMAL) return <Meh className="h-4 w-4 text-slate-400" aria-label="気分: 普通" />;
  if (mood === MOOD.BAD) return <Frown className="h-4 w-4 text-rose-400" aria-label="気分: 疲れた" />;
  return <span className="text-[10px] font-semibold text-slate-300" aria-label="気分: 未記録">—</span>;
}

function statusStyle(status) {
  if (status === STATUS.AS_PLANNED) return { accent: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', label: '予定通り' };
  if (status === STATUS.CHANGED) return { accent: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700', label: '変更' };
  if (status === STATUS.SKIPPED) return { accent: 'bg-rose-400', badge: 'bg-rose-50 text-rose-600', label: '休んだ' };
  return { accent: 'bg-indigo-300', badge: 'bg-slate-100 text-slate-500', label: '未記録' };
}

function TimelineTitle({ schedule, recorded, planned }) {
  if (!recorded) return schedule.title;
  const legacyPlanReference = !schedule.plannedSnapshot;
  if (schedule.status === STATUS.CHANGED) {
    return (
      <span className="flex flex-col">
        <span className={`text-[8px] font-normal text-slate-400 ${legacyPlanReference ? '' : 'line-through'}`}>
          {legacyPlanReference ? `現在の予定: ${schedule.title}` : planned.title}
        </span>
        <span className="break-words">{schedule.actualTitle}<span className="ml-1 text-[8px] font-medium text-amber-600">{schedule.actualCategory ? `・${schedule.actualCategory}` : ''}</span></span>
      </span>
    );
  }
  if (schedule.status === STATUS.SKIPPED) {
    return legacyPlanReference
      ? <span className="text-slate-500">現在の予定: {schedule.title}</span>
      : <span className="text-slate-500 line-through">{planned.title}</span>;
  }
  const recordedTitle = schedule.actualTitle || planned.title;
  const recordedCategory = schedule.actualCategory || planned.category;
  const planChangedAfterRecord = legacyPlanReference
    ? recordedTitle !== schedule.title || recordedCategory !== schedule.category
    : planned.title !== schedule.title || planned.category !== schedule.category;
  if (!planChangedAfterRecord) return recordedTitle;
  return <span className="flex flex-col"><span className="text-[8px] font-normal text-slate-400">現在: {schedule.title}</span><span className="break-words">記録時: {recordedTitle}<span className="ml-1 text-[8px] font-medium text-emerald-700">{recordedCategory ? `・${recordedCategory}` : ''}</span></span></span>;
}

function sortSchedulesByRecordedPlanTime(schedules) {
  const list = Array.isArray(schedules) ? schedules : [];
  return [...list].sort((a, b) => (
    timeToHours(recordedPlanForSchedule(a)?.time) - timeToHours(recordedPlanForSchedule(b)?.time)
  ));
}

export function TrackView({ schedules, dueSchedules = [], dateKey, canRecord = true, onRecord }) {
  const orderedSchedules = sortSchedulesByRecordedPlanTime(schedules);
  const firstDue = canRecord ? (dueSchedules[0] ?? null) : null;
  const today = isToday(dateKey);

  if (orderedSchedules.length === 0) {
    return (
      <div className="animate-fade-in pt-3.5">
        <section className="app-card-strong rounded-[1.25rem] p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500"><Clock3 className="h-4.5 w-4.5" /></div>
          <h2 className="mt-3.5 text-[15px] font-semibold text-slate-800">記録する予定がまだありません</h2>
          <p className="mx-auto mt-1.5 max-w-[17rem] text-[11px] leading-relaxed text-slate-500">計画タブで予定を置くと、ここに「予定と現実」のタイムラインができます。</p>
        </section>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-3.5 pt-3.5">
      <div className="px-0.5">
        <p className="text-[8px] font-semibold tracking-[0.16em] text-indigo-500">REALITY</p>
        <h2 className="mt-1 text-[1.2rem] font-semibold tracking-[-0.025em] text-slate-900">{today ? '今日の現実' : 'この日の現実'}</h2>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{canRecord ? 'できた・変えた・休んだを、そのまま残す' : '未来日は予定だけ確認できます。実績は当日以降に記録できます。'}</p>
      </div>

      {firstDue && (
        <button
          type="button"
          onClick={() => onRecord(firstDue)}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-amber-200/75 bg-amber-50/70 px-3 py-2.5 text-left transition hover:border-amber-300 active:scale-[0.99]"
          aria-label={`記録待ち ${dueSchedules.length}件。${firstDue.time} ${firstDue.title} を記録する`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm"><BellRing className="h-4 w-4" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold text-amber-900">記録待ち {dueSchedules.length}件</div>
            <p className="mt-0.5 truncate text-[9px] font-medium text-amber-700">{firstDue.time} {firstDue.title}</p>
          </div>
          <span className="shrink-0 text-[9px] font-semibold text-indigo-600">記録する</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-indigo-300" aria-hidden="true" />
        </button>
      )}

      <StressGraph schedules={orderedSchedules} dateKey={dateKey} />

      <section className="space-y-2.5" aria-labelledby="timeline-title">
        <div className="flex items-end justify-between gap-3 px-0.5">
          <div><h2 id="timeline-title" className="text-[14px] font-semibold text-slate-800">実行タイムライン</h2><p className="mt-0.5 text-[9px] text-slate-400">予定と、実際どうだったか</p></div>
          <span className="text-[9px] font-medium text-slate-400">{orderedSchedules.length}件</span>
        </div>

        <div className="relative ml-2 space-y-2.5 border-l border-indigo-100/80 pb-2">
          {orderedSchedules.map((schedule) => {
            const recorded = schedule.status !== STATUS.PENDING;
            const legacyPlanReference = recorded && !schedule.plannedSnapshot;
            const planned = recorded ? recordedPlanForSchedule(schedule) : schedule;
            const plannedTime = planned?.time ?? schedule.time;
            const plannedTitle = planned?.title ?? schedule.title;
            const plannedStress = planned?.plannedStress ?? schedule.plannedStress;
            const actualDateDiffers = schedule.actualStartDateKey && schedule.actualStartDateKey !== dateKey;
            const style = statusStyle(schedule.status);
            const cardClassName = `app-card relative w-full overflow-hidden rounded-[1.05rem] px-3 py-2.5 text-left ${canRecord ? 'transition hover:shadow-[0_10px_28px_rgba(15,23,42,0.055)] active:scale-[0.99]' : 'cursor-default'}`;
            const cardContent = (
              <>
                <span className={`absolute inset-y-3 left-0 w-[2px] rounded-r-full ${style.accent}`} aria-hidden="true" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-[13px] font-semibold text-slate-800"><TimelineTitle schedule={schedule} recorded={recorded} planned={planned} /></div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {legacyPlanReference && <span className="rounded-full bg-slate-50 px-2 py-1 text-[7px] font-semibold text-slate-400">記録時の予定不明</span>}
                    {recorded && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50"><MoodIcon mood={schedule.mood} /></span>}
                    <span className={`rounded-full px-2 py-1 text-[8px] font-semibold ${style.badge}`}>{style.label}</span>
                  </div>
                </div>

                {recorded && schedule.status !== STATUS.SKIPPED && (!schedule.actualStartTime || !schedule.actualStartDateKey) && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[8px] font-medium">
                    {!schedule.actualStartTime && <span className="rounded-full bg-slate-50 px-2 py-1 text-slate-400">開始時刻なし</span>}
                    {schedule.actualStartTime && !schedule.actualStartDateKey && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-600">開始日不明</span>}
                  </div>
                )}

                {recorded && schedule.deviationReason && <p className="mt-2 line-clamp-2 border-l-2 border-slate-200 pl-2.5 text-[9px] leading-relaxed text-slate-500">{schedule.deviationReason}</p>}

                <div className="mt-2 flex min-h-8 items-center justify-between gap-3 border-t border-slate-100 pt-2">
                  {recorded ? (
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[9px] font-medium text-slate-400">
                      <span>{legacyPlanReference ? '現在の予定負荷' : '予定負荷'} {plannedStress}</span>
                      <span className={schedule.actualStress > 80 ? 'text-rose-500' : schedule.actualStress === null ? 'text-slate-400' : 'text-indigo-600'}>実負荷 {schedule.actualStress ?? '—'}</span>
                      <span className="text-slate-600">実時間 {schedule.actualDuration === null ? '—' : `${schedule.actualDuration}分`}</span>
                    </div>
                  ) : (
                    <span className="text-[9px] font-medium text-slate-400">予定負荷 {plannedStress}</span>
                  )}
                  <span className={`flex shrink-0 items-center gap-0.5 text-[9px] font-semibold ${canRecord ? (recorded ? 'text-slate-400' : 'text-indigo-600') : 'text-slate-300'}`}>{canRecord ? (recorded ? '編集' : '記録する') : '予定'}{canRecord && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}</span>
                </div>
              </>
            );
            return (
              <article key={schedule.id} className="relative pl-4">
                <div className={`absolute -left-[4px] top-4 h-2 w-2 rounded-full ring-[3px] ring-[#f6f7fb] ${style.accent}`} aria-hidden="true" />
                <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-indigo-600">
                  <time dateTime={`${dateKey}T${plannedTime}`}>{plannedTime}</time>
                  {legacyPlanReference && <span className="text-[8px] font-medium text-slate-400">現在の予定時刻</span>}
                  {recorded && schedule.actualStartTime && schedule.status !== STATUS.SKIPPED && <><span className="text-slate-300">→</span><span className="flex items-center gap-1 text-pink-600"><Clock3 className="h-3 w-3" aria-hidden="true" />{actualDateDiffers ? `${formatShortDateLabel(schedule.actualStartDateKey)} ` : ''}{schedule.actualStartTime}</span></>}
                </div>

                {canRecord ? (
                  <button type="button" onClick={() => onRecord(schedule)} className={cardClassName} aria-label={`${plannedTime} ${plannedTitle} の実績を${recorded ? '編集' : '記録'}する`}>{cardContent}</button>
                ) : (
                  <div className={cardClassName} aria-label={`${plannedTime} ${plannedTitle}。未来日のため実績はまだ記録できません`}>{cardContent}</div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
