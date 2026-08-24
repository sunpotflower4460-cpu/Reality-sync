import { Copy, LayoutTemplate, Pencil, Plus, Sparkles } from 'lucide-react';
import { STATUS } from '../constants.js';
import { sortSchedulesByTime } from '../utils/schedule.js';

function stressTone(value) {
  if (value > 70) return { borderColor: '#fca5a5', color: '#ef4444' };
  if (value > 40) return { borderColor: '#fde047', color: '#ca8a04' };
  return { borderColor: '#bbf7d0', color: '#16a34a' };
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
    <div className="animate-fade-in space-y-6 pt-4">
      <div className="mb-2 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-gray-800">理想のスケジュール</h2>
          <p className="mt-1 text-xs text-gray-500">まずは「こう過ごしたい」を置いてみる</p>
        </div>
        <span className="text-xs text-gray-500">{orderedSchedules.length}件</span>
      </div>

      <div className="space-y-3">
        {orderedSchedules.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-7 text-center shadow-sm">
            <div className="mb-2 text-sm font-bold text-gray-700">この日の予定はまだありません</div>
            <p className="text-xs leading-relaxed text-gray-500">最初から完璧に埋めなくて大丈夫です。まずは1つだけ置いてみてもOKです。</p>
          </div>
        )}
        {orderedSchedules.map((schedule) => {
          const recorded = schedule.status !== STATUS.PENDING;
          return (
            <article key={schedule.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm">
              <button type="button" onClick={() => onEdit(schedule.id)} className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-gray-50/70" aria-label={`${schedule.time} ${schedule.title} を編集`}>
                <time className="w-12 shrink-0 text-center font-bold text-indigo-600" dateTime={schedule.time}>{schedule.time}</time>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-bold text-gray-800">{schedule.title}</div>
                    {recorded && <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-500">実績あり</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">{schedule.category}</span>
                    <span className="text-[10px] text-gray-400">{schedule.duration}分</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="mb-1 text-[10px] font-bold text-gray-400">想定負荷</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-4 text-xs font-bold" style={stressTone(schedule.plannedStress)} aria-label={`想定負荷 ${schedule.plannedStress}`}>{schedule.plannedStress}</div>
                  </div>
                  <Pencil className="h-4 w-4 text-gray-300" aria-hidden="true" />
                </div>
              </button>
            </article>
          );
        })}
      </div>

      <button type="button" onClick={onCreate} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 py-4 font-bold text-indigo-500 transition-colors hover:bg-indigo-50">
        <Plus className="h-5 w-5" aria-hidden="true" />予定を追加する
      </button>

      {primaryHint && (
        <button type="button" onClick={() => onReviewPlanFeedback?.(primaryHint)} className="flex w-full items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-left transition hover:border-indigo-200">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-500 shadow-sm"><Sparkles className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-extrabold text-indigo-900">前の記録からのヒント</div>
            <p className="mt-1 truncate text-[10px] text-indigo-600">{primaryHint.preview.before.time} {primaryHint.preview.before.title} ・ {primaryHint.preview.adjustmentLabel}</p>
          </div>
          <span className="shrink-0 text-[10px] font-bold text-indigo-600">見てみる</span>
        </button>
      )}

      <details className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold text-gray-500">予定を楽に作る</summary>
        <div className="grid grid-cols-2 gap-2 border-t border-gray-100 p-3">
          <button
            type="button"
            onClick={onCopyPrevious}
            disabled={!hasPreviousSchedules}
            className="flex min-h-16 flex-col items-start justify-between rounded-xl bg-gray-50 p-3 text-left transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Copy className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            <span className="mt-2 text-[11px] font-bold text-gray-700">前日からコピー</span>
          </button>
          <button
            type="button"
            onClick={onOpenTemplates}
            className="flex min-h-16 flex-col items-start justify-between rounded-xl bg-gray-50 p-3 text-left transition hover:bg-indigo-50"
          >
            <div className="flex w-full items-center justify-between"><LayoutTemplate className="h-4 w-4 text-indigo-500" aria-hidden="true" /><span className="text-[9px] font-bold text-gray-400">{templateCount}</span></div>
            <span className="mt-2 text-[11px] font-bold text-gray-700">テンプレート</span>
          </button>
        </div>
      </details>
    </div>
  );
}
