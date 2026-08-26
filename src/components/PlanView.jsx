import { CheckCircle2, ChevronDown, ChevronRight, Copy, LayoutTemplate, Plus, Sparkles } from 'lucide-react';
import { STATUS } from '../constants.js';
import { sortSchedulesByTime } from '../utils/schedule.js';

function stressTone(value) {
  if (value > 70) return { dot: 'bg-rose-400', text: 'text-rose-500' };
  if (value > 40) return { dot: 'bg-amber-400', text: 'text-amber-600' };
  return { dot: 'bg-emerald-400', text: 'text-emerald-600' };
}

export function PlanView({
  schedules,
  onCreate,
  onEdit,
  onCopyPrevious,
  hasPreviousSchedules,
  onOpenTemplates,
  templateCount = 0,
  planFeedbackSuggestions = [],
  onReviewPlanFeedback,
}) {
  const orderedSchedules = sortSchedulesByTime(schedules);
  const primaryHint = planFeedbackSuggestions[0] ?? null;

  return (
    <div className="animate-fade-in space-y-3.5 pt-3.5">
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div>
          <p className="text-[8px] font-semibold tracking-[0.16em] text-indigo-500">PLAN</p>
          <h2 className="mt-1 text-[1.2rem] font-semibold tracking-[-0.025em] text-slate-900">理想のスケジュール</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">まずは「こう過ごしたい」を、無理なく置いてみる</p>
        </div>
        {orderedSchedules.length > 0 && <span className="shrink-0 pb-0.5 text-[10px] font-medium text-slate-400">{orderedSchedules.length}件</span>}
      </div>

      {orderedSchedules.length === 0 ? (
        <section className="app-card-strong rounded-[1.25rem] p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Plus className="h-4.5 w-4.5" aria-hidden="true" /></div>
          <h3 className="mt-3.5 text-[15px] font-semibold text-slate-800">最初の予定を1つ置いてみる</h3>
          <p className="mx-auto mt-1.5 max-w-[16rem] text-[11px] leading-relaxed text-slate-500">1日を全部埋めなくて大丈夫です。今日いちばん大事な予定から。</p>
          <button type="button" onClick={onCreate} className="mt-4 min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-[12px] font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.99]">
            予定を追加する
          </button>
        </section>
      ) : (
        <>
          <div className="app-group divide-y divide-slate-100">
            {orderedSchedules.map((schedule) => {
              const recorded = schedule.status !== STATUS.PENDING;
              const tone = stressTone(schedule.plannedStress);
              return (
                <article key={schedule.id}>
                  <button type="button" onClick={() => onEdit(schedule.id)} className="flex min-h-[4.4rem] w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-slate-50/75 active:bg-slate-100/80" aria-label={`${schedule.time} ${schedule.title} を編集`}>
                    <time className="w-[3rem] shrink-0 text-[12px] font-semibold tracking-tight text-indigo-600" dateTime={schedule.time}>{schedule.time}</time>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <div className="truncate text-[13px] font-semibold text-slate-800">{schedule.title}</div>
                        {recorded && <span className="flex shrink-0 items-center gap-1 text-[8px] font-medium text-emerald-600"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />記録済み</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-medium text-slate-400">
                        <span className="text-slate-500">{schedule.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{schedule.duration}分</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`flex items-center gap-1.5 text-[9px] font-medium ${tone.text}`}><span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />負荷 {schedule.plannedStress}</span>
                      <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
                    </div>
                  </button>
                </article>
              );
            })}
          </div>

          <button type="button" onClick={onCreate} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100 active:scale-[0.99]">
            <Plus className="h-4 w-4" aria-hidden="true" />予定を追加
          </button>
        </>
      )}

      {primaryHint && (
        <button type="button" onClick={() => onReviewPlanFeedback?.(primaryHint)} className="app-group flex min-h-14 w-full items-center gap-3 p-3 text-left transition hover:border-indigo-200 active:bg-indigo-50/40">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500"><Sparkles className="h-4 w-4" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold text-slate-700">前の記録からのヒント</div>
            <p className="mt-0.5 truncate text-[9px] font-medium text-slate-500">{primaryHint.preview.before.time} {primaryHint.preview.before.title} ・ {primaryHint.preview.adjustmentLabel}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-indigo-300" aria-hidden="true" />
        </button>
      )}

      <details className="app-group group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[10px] font-medium text-slate-500">
          <span>予定を楽に作る</span><ChevronDown className="h-4 w-4 text-slate-300 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
          <button type="button" onClick={onCopyPrevious} disabled={!hasPreviousSchedules} className="flex min-h-14 flex-col items-start justify-between rounded-xl bg-slate-50 p-3 text-left transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40">
            <Copy className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            <span className="mt-2 text-[10px] font-semibold text-slate-700">前日からコピー</span>
          </button>
          <button type="button" onClick={onOpenTemplates} className="flex min-h-14 flex-col items-start justify-between rounded-xl bg-slate-50 p-3 text-left transition hover:bg-indigo-50">
            <div className="flex w-full items-center justify-between"><LayoutTemplate className="h-4 w-4 text-indigo-500" aria-hidden="true" /><span className="rounded-full bg-white px-1.5 py-0.5 text-[8px] font-medium text-slate-400">{templateCount}</span></div>
            <span className="mt-2 text-[10px] font-semibold text-slate-700">テンプレート</span>
          </button>
        </div>
      </details>
    </div>
  );
}
