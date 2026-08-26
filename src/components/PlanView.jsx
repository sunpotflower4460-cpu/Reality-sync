import { CheckCircle2, ChevronDown, ChevronRight, Copy, LayoutTemplate, Plus, Sparkles } from 'lucide-react';
import { STATUS } from '../constants.js';
import { sortSchedulesByTime } from '../utils/schedule.js';

function stressTone(value) {
  if (value > 70) return { bg: '#fef2f2', text: '#dc2626' };
  if (value > 40) return { bg: '#fffbeb', text: '#b45309' };
  return { bg: '#f0fdf4', text: '#15803d' };
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
    <div className="animate-fade-in space-y-4 pt-4">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[9px] font-black tracking-[0.18em] text-indigo-500">PLAN</p>
          <h2 className="mt-1 text-[1.25rem] font-black tracking-tight text-slate-900">理想のスケジュール</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">まずは「こう過ごしたい」を、無理なく置いてみる</p>
        </div>
        {orderedSchedules.length > 0 && <span className="shrink-0 text-[10px] font-extrabold text-slate-400">{orderedSchedules.length}件</span>}
      </div>

      {orderedSchedules.length === 0 ? (
        <section className="app-card-strong rounded-[1.55rem] p-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Plus className="h-5 w-5" aria-hidden="true" /></div>
          <h3 className="mt-4 text-base font-black text-slate-800">最初の予定を1つ置いてみる</h3>
          <p className="mx-auto mt-2 max-w-[16rem] text-xs leading-relaxed text-slate-500">1日を全部埋めなくて大丈夫です。まずは今日いちばん大事な予定から。</p>
          <button type="button" onClick={onCreate} className="mt-5 min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-extrabold text-white transition hover:bg-indigo-700 active:scale-[0.99]">
            予定を追加する
          </button>
        </section>
      ) : (
        <>
          <div className="space-y-2">
            {orderedSchedules.map((schedule) => {
              const recorded = schedule.status !== STATUS.PENDING;
              const tone = stressTone(schedule.plannedStress);
              return (
                <article key={schedule.id} className="app-card overflow-hidden rounded-[1.2rem]">
                  <button type="button" onClick={() => onEdit(schedule.id)} className="flex min-h-[4.75rem] w-full items-center gap-3 p-3 text-left transition hover:bg-slate-50/70 active:bg-slate-50" aria-label={`${schedule.time} ${schedule.title} を編集`}>
                    <div className="flex w-[3rem] shrink-0 items-center justify-center rounded-xl bg-indigo-50/75 py-2">
                      <time className="text-[13px] font-black tracking-tight text-indigo-700" dateTime={schedule.time}>{schedule.time}</time>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <div className="truncate text-sm font-black text-slate-800">{schedule.title}</div>
                        {recorded && <span className="flex shrink-0 items-center gap-1 text-[9px] font-bold text-emerald-600"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />記録済み</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-slate-400">
                        <span className="text-slate-600">{schedule.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{schedule.duration}分</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ backgroundColor: tone.bg, color: tone.text }}>負荷 {schedule.plannedStress}</span>
                      <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
                    </div>
                  </button>
                </article>
              );
            })}
          </div>

          <button type="button" onClick={onCreate} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-extrabold text-white transition hover:bg-indigo-700 active:scale-[0.99]">
            <Plus className="h-4 w-4" aria-hidden="true" />予定を追加する
          </button>
        </>
      )}

      {primaryHint && (
        <button type="button" onClick={() => onReviewPlanFeedback?.(primaryHint)} className="app-card flex min-h-14 w-full items-center gap-3 rounded-xl p-3 text-left transition hover:border-indigo-200 active:bg-indigo-50/40">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500"><Sparkles className="h-4 w-4" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black text-slate-700">前の記録からのヒント</div>
            <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{primaryHint.preview.before.time} {primaryHint.preview.before.title} ・ {primaryHint.preview.adjustmentLabel}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
        </button>
      )}

      <details className="app-card group rounded-xl">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[11px] font-extrabold text-slate-500">
          <span>予定を楽に作る</span><ChevronDown className="h-4 w-4 text-slate-300 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
          <button type="button" onClick={onCopyPrevious} disabled={!hasPreviousSchedules} className="flex min-h-16 flex-col items-start justify-between rounded-xl bg-slate-50 p-3 text-left transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40">
            <Copy className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            <span className="mt-2 text-[10px] font-extrabold text-slate-700">前日からコピー</span>
          </button>
          <button type="button" onClick={onOpenTemplates} className="flex min-h-16 flex-col items-start justify-between rounded-xl bg-slate-50 p-3 text-left transition hover:bg-indigo-50">
            <div className="flex w-full items-center justify-between"><LayoutTemplate className="h-4 w-4 text-indigo-500" aria-hidden="true" /><span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-400">{templateCount}</span></div>
            <span className="mt-2 text-[10px] font-extrabold text-slate-700">テンプレート</span>
          </button>
        </div>
      </details>
    </div>
  );
}
