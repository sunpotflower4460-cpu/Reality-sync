import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarRange, CheckCircle2, FlaskConical, XCircle } from 'lucide-react';
import { formatShortDateLabel, formatWeekLabel } from '../utils/date.js';
import { simulateWeeklyPlanFeedback } from '../utils/weeklyPlanningFeedback.js';
import { ModalDialog } from './ModalDialog.jsx';

function percent(rate) {
  if (rate === null || rate === undefined || rate === '') return '—';
  const numeric = Number(rate);
  return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : '—';
}

export function WeeklyPlanFeedbackModal({ weeklyPlan, experiments, days, onApply, onClose }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const simulation = useMemo(
    () => simulateWeeklyPlanFeedback(experiments, days, weeklyPlan, selectedIds),
    [days, experiments, selectedIds, weeklyPlan],
  );
  const conflictIds = new Set(simulation.conflicts.map((item) => item.suggestionId));
  const grouped = useMemo(() => {
    const result = new Map();
    for (const suggestion of weeklyPlan?.suggestions ?? []) {
      const list = result.get(suggestion.dateKey) ?? [];
      list.push(suggestion);
      result.set(suggestion.dateKey, list);
    }
    return [...result.entries()];
  }, [weeklyPlan]);

  const toggle = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <ModalDialog
      onClose={onClose}
      labelledBy="weekly-plan-feedback-title"
      className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl"
    >
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="weekly-plan-feedback-title" className="flex items-center gap-2 font-extrabold text-gray-900"><CalendarRange className="h-5 w-5 text-indigo-600" />今週の現実適応プラン</h3>
            <p className="mt-1 text-[11px] text-gray-400">{formatWeekLabel(weeklyPlan?.anchorDateKey)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="週間プレビューを閉じる" className="rounded-full bg-gray-100 p-1.5 text-gray-400 hover:text-gray-600"><XCircle className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 rounded-2xl bg-indigo-50 p-3 text-[11px] leading-relaxed text-indigo-700">
          採用済み実験を、今週の未記録予定へ戻す候補です。最初は何も選択していません。検討順は試行回数と観測差を整理するための参考で、最適性や因果を意味しません。
        </div>
      </div>

      <div className="space-y-5 p-4">
        {(weeklyPlan?.suggestions?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">この週に再利用できる採用済みの工夫はありません。</div>
        ) : grouped.map(([dateKey, suggestions]) => (
          <section key={dateKey}>
            <h4 className="mb-2 text-xs font-extrabold text-gray-500">{formatShortDateLabel(dateKey)}</h4>
            <div className="space-y-2">
              {suggestions.map((suggestion) => {
                const selected = selectedIds.includes(suggestion.id);
                const canApply = Boolean(suggestion.preview?.canApply);
                const conflicted = conflictIds.has(suggestion.id);
                return (
                  <label key={suggestion.id} className={`block rounded-2xl border p-3 ${conflicted ? 'border-red-200 bg-red-50/50' : selected ? 'border-indigo-300 bg-indigo-50/60' : 'border-gray-100 bg-white'} ${canApply ? 'cursor-pointer' : 'opacity-75'}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={selected} disabled={!canApply} onChange={() => toggle(suggestion.id)} className="mt-1 h-4 w-4 accent-indigo-600" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-extrabold text-gray-800">{suggestion.preview?.before?.time} {suggestion.preview?.before?.title}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold text-gray-500">検討順 {suggestion.evidenceOrder}</span>
                        </div>
                        <div className="mt-1 text-[11px] font-bold text-indigo-600">{suggestion.preview?.adjustmentLabel}</div>
                        <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px]">
                          <div className="rounded-lg bg-gray-50 px-1 py-1.5"><div className="text-gray-400">過去基準</div><div className="font-black text-gray-700">{percent(suggestion.preview?.baselineFailureRate)}</div></div>
                          <div className="rounded-lg bg-gray-50 px-1 py-1.5"><div className="text-gray-400">実験中</div><div className="font-black text-gray-700">{percent(suggestion.preview?.experimentFailureRate)}</div></div>
                          <div className="rounded-lg bg-gray-50 px-1 py-1.5"><div className="text-gray-400">試行</div><div className="font-black text-gray-700">{suggestion.preview?.trialCount ?? 0}回</div></div>
                        </div>
                        {!canApply && <p className="mt-2 text-[10px] leading-relaxed text-amber-700">{suggestion.preview?.error}</p>}
                        {conflicted && <p className="mt-2 flex items-start gap-1 text-[10px] font-bold leading-relaxed text-red-600"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{simulation.conflicts.find((item) => item.suggestionId === suggestion.id)?.message}</p>}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        ))}

        {(weeklyPlan?.multipleTargetGroups?.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-800">
            同じ予定に複数の採用済み工夫が一致している箇所があります。週一括では変更順を勝手に決めないため、その予定では1つだけ選んでください。必要なら反映後にもう一度プレビューできます。
          </div>
        )}

        {selectedIds.length > 0 && !simulation.ok && (
          <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-3 text-[11px] leading-relaxed text-red-700">
            <div className="mb-1 flex items-center gap-1 font-extrabold"><AlertTriangle className="h-4 w-4" />この組み合わせは一括反映できません</div>
            {simulation.error}
          </div>
        )}

        {simulation.ok && (
          <div className="rounded-2xl border border-green-100 bg-green-50 p-3 text-[11px] leading-relaxed text-green-700">
            <div className="mb-1 flex items-center gap-1 font-extrabold"><CheckCircle2 className="h-4 w-4" />{simulation.applied.length}件を一括反映できます</div>
            この確認はまだ仮想適用です。「選んだ工夫を反映」を押すまで予定は変更されません。
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-gray-100 bg-white p-4">
        <button type="button" disabled={!simulation.ok} onClick={() => onApply?.(selectedIds)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 font-bold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"><FlaskConical className="h-4 w-4" />選んだ工夫を反映</button>
        <p className="mt-2 text-center text-[9px] leading-relaxed text-gray-400">競合がある場合は一部だけを自動採用せず、全体を止めます。</p>
      </div>
    </ModalDialog>
  );
}
