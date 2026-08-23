import { Copy, FlaskConical, LayoutTemplate, Pencil, Plus } from 'lucide-react';
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
  const feedbackCountBySchedule = new Map();
  for (const suggestion of planFeedbackSuggestions) {
    const key = String(suggestion.scheduleId);
    feedbackCountBySchedule.set(key, (feedbackCountBySchedule.get(key) ?? 0) + 1);
  }

  return (
    <div className="animate-fade-in space-y-6 pt-4">
      <div className="mb-2 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-gray-800">理想のスケジュール</h2>
          <p className="mt-1 text-xs text-gray-500">まずは「こう過ごしたい」を置いてみる</p>
        </div>
        <span className="text-xs text-gray-500">{orderedSchedules.length}件</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCopyPrevious}
          disabled={!hasPreviousSchedules}
          className="flex min-h-20 flex-col items-start justify-between rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:border-indigo-100 hover:bg-indigo-50/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Copy className="h-5 w-5 text-indigo-500" aria-hidden="true" />
          <span><span className="block text-xs font-bold text-gray-700">前日からコピー</span><span className="mt-0.5 block text-[9px] leading-relaxed text-gray-400">実績はコピーしません</span></span>
        </button>
        <button
          type="button"
          onClick={onOpenTemplates}
          className="flex min-h-20 flex-col items-start justify-between rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:border-indigo-100 hover:bg-indigo-50/50"
        >
          <div className="flex w-full items-center justify-between"><LayoutTemplate className="h-5 w-5 text-indigo-500" aria-hidden="true" /><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-500">{templateCount}</span></div>
          <span><span className="block text-xs font-bold text-gray-700">テンプレート</span><span className="mt-0.5 block text-[9px] leading-relaxed text-gray-400">平日・休日などを再利用</span></span>
        </button>
      </div>

      {planFeedbackSuggestions.length > 0 && (
        <section className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="flex items-center gap-2 text-sm font-extrabold text-indigo-900"><FlaskConical className="h-4 w-4" />実験から学んだ計画の工夫</h3><p className="mt-1 text-[10px] leading-relaxed text-indigo-600">採用した実験が今日の未記録予定に一致しています。自動変更せず、1件ずつプレビューします。</p></div>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-indigo-600">{planFeedbackSuggestions.length}件</span>
          </div>
          <div className="mt-3 space-y-2">
            {planFeedbackSuggestions.slice(0, 6).map((suggestion) => (
              <button key={suggestion.id} type="button" onClick={() => onReviewPlanFeedback?.(suggestion)} className="flex w-full items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-3 text-left transition hover:border-indigo-200">
                <div className="min-w-0 flex-1"><div className="truncate text-xs font-extrabold text-gray-800">{suggestion.preview.before.time} {suggestion.preview.before.title}</div><div className="mt-1 truncate text-[10px] text-indigo-600">{suggestion.preview.adjustmentLabel}</div></div>
                <span className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white">確認</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-3">
        {orderedSchedules.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-7 text-center shadow-sm">
            <div className="mb-2 text-sm font-bold text-gray-700">この日の予定はまだありません</div>
            <p className="text-xs leading-relaxed text-gray-500">最初から完璧に埋めなくて大丈夫です。前日の予定やテンプレートを使うこともできます。</p>
          </div>
        )}
        {orderedSchedules.map((schedule) => {
          const recorded = schedule.status !== STATUS.PENDING;
          const feedbackCount = feedbackCountBySchedule.get(String(schedule.id)) ?? 0;
          return (
            <article key={schedule.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm">
              <button type="button" onClick={() => onEdit(schedule.id)} className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-gray-50/70" aria-label={`${schedule.time} ${schedule.title} を編集`}>
                <time className="w-12 shrink-0 text-center font-bold text-indigo-600" dateTime={schedule.time}>{schedule.time}</time>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-bold text-gray-800">{schedule.title}</div>
                    {recorded && <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-500">実績あり</span>}
                    {feedbackCount > 0 && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-600">学習提案 {feedbackCount}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">{schedule.category}</span>
                    <span className="text-[10px] text-gray-400">{schedule.duration}分</span>
                    {schedule.appliedExperimentIds?.length > 0 && <span className="text-[10px] font-bold text-green-600">採用済みの工夫を反映</span>}
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
    </div>
  );
}
