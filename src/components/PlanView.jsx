import { Copy, LayoutTemplate, Pencil, Plus, Sparkles } from 'lucide-react';
import { STATUS } from '../constants.js';
import { sortSchedulesByTime } from '../utils/schedule.js';

function stressTone(value) {
  if (value > 70) return { accent: '#ef4444', bg: '#fef2f2', text: '#dc2626', label: '高め' };
  if (value > 40) return { accent: '#f59e0b', bg: '#fffbeb', text: '#b45309', label: '中' };
  return { accent: '#22c55e', bg: '#f0fdf4', text: '#15803d', label: '低め' };
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
    <div className="animate-fade-in space-y-5 pt-4">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-black tracking-[0.16em] text-indigo-500">PLAN</p>
          <h2 className="mt-1 text-[1.35rem] font-black tracking-tight text-slate-900">理想のスケジュール</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">まずは「こう過ごしたい」を、無理なく置いてみる</p>
        </div>
        {orderedSchedules.length > 0 && <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-slate-400 shadow-sm ring-1 ring-slate-200/70">{orderedSchedules.length}件</span>}
      </div>

      {orderedSchedules.length === 0 ? (
        <section className="app-card-strong rounded-[1.75rem] p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Plus className="h-5 w-5" aria-hidden="true" /></div>
          <h3 className="mt-4 text-base font-black text-slate-800">最初の予定を1つ置いてみる</h3>
          <p className="mx-auto mt-2 max-w-[16rem] text-xs leading-relaxed text-slate-500">1日を全部埋めなくて大丈夫です。まずは今日いちばん大事な予定から。</p>
          <button type="button" onClick={onCreate} className="mt-5 min-h-12 w-full rounded-2xl bg-indigo-600 px-4 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(79,70,229,0.24)] transition hover:bg-indigo-700 active:scale-[0.99]">
            予定を追加する
          </button>
        </section>
      ) : (
        <>
          <div className="space-y-2.5">
            {orderedSchedules.map((schedule) => {
              const recorded = schedule.status !== STATUS.PENDING;
              const tone = stressTone(schedule.plannedStress);
              return (
                <article key={schedule.id} className="app-card overflow-hidden rounded-[1.35rem]">
                  <button type="button" onClick={() => onEdit(schedule.id)} className="relative flex min-h-[5.4rem] w-full items-center gap-3.5 p-3.5 text-left transition hover:bg-slate-50/70 active:bg-slate-50" aria-label={`${schedule.time} ${schedule.title} を編集`}>
                    <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ backgroundColor: tone.accent }} aria-hidden="true" />
                    <div className="flex w-[3.15rem] shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50/70 py-2">
                      <time className="text-sm font-black tracking-tight text-indigo-700" dateTime={schedule.time}>{schedule.time}</time>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-sm font-black text-slate-800">{schedule.title}</div>
                        {recorded && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">記録済み</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-slate-400">
                        <span className="rounded-md bg-slate-100/80 px-2 py-0.5 text-slate-600">{schedule.category}</span>
                        <span>{schedule.duration}分</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <div className="rounded-xl px-2.5 py-1.5 text-center" style={{ backgroundColor: tone.bg, color: tone.text }}>
                        <div className="text-[8px] font-extrabold opacity-70">負荷</div>
                        <div className="text-sm font-black leading-none">{schedule.plannedStress}</div>
                      </div>
                      <Pencil className="h-4 w-4 text-slate-300" aria-hidden="true" />
                    </div>
                  </button>
                </article>
              );
            })}
          </div>

          <button type="button" onClick={onCreate} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(79,70,229,0.22)] transition hover:bg-indigo-700 active:scale-[0.99]">
            <Plus className="h-4 w-4" aria-hidden="true" />予定を追加する
          </button>
        </>
      )}

      {primaryHint && (
        <button type="button" onClick={() => onReviewPlanFeedback?.(primaryHint)} className="app-card flex min-h-16 w-full items-center gap-3 rounded-2xl p-3.5 text-left transition hover:border-indigo-200 active:bg-indigo-50/40">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500"><Sparkles className="h-4 w-4" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black text-slate-700">前の記録からのヒント</div>
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">{primaryHint.preview.before.time} {primaryHint.preview.before.title} ・ {primaryHint.preview.adjustmentLabel}</p>
          </div>
          <span className="shrink-0 text-[10px] font-extrabold text-indigo-600">見る</span>
        </button>
      )}

      <details className="app-card rounded-2xl">
        <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 py-3 text-xs font-extrabold text-slate-500">予定を楽に作る</summary>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
          <button type="button" onClick={onCopyPrevious} disabled={!hasPreviousSchedules} className="flex min-h-20 flex-col items-start justify-between rounded-xl bg-slate-50 p-3 text-left transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40">
            <Copy className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            <span className="mt-3 text-[11px] font-extrabold text-slate-700">前日からコピー</span>
          </button>
          <button type="button" onClick={onOpenTemplates} className="flex min-h-20 flex-col items-start justify-between rounded-xl bg-slate-50 p-3 text-left transition hover:bg-indigo-50">
            <div className="flex w-full items-center justify-between"><LayoutTemplate className="h-4 w-4 text-indigo-500" aria-hidden="true" /><span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-400">{templateCount}</span></div>
            <span className="mt-3 text-[11px] font-extrabold text-slate-700">テンプレート</span>
          </button>
        </div>
      </details>
    </div>
  );
}
