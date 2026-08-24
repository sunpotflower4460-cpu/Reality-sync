import { GitBranch } from 'lucide-react';
import { formatShortDateLabel } from '../utils/date.js';

function percent(value) {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

function valueText(candidate, value) {
  if (value === null || value === undefined) return '—';
  if (candidate.valueKind === 'rate') return percent(value);
  return `${value}${candidate.unit}`;
}

function differenceText(candidate) {
  const value = candidate.difference;
  if (value === null || value === undefined) return '—';
  if (candidate.valueKind === 'rate') {
    const points = Math.round(value * 100);
    return `${points > 0 ? '+' : ''}${points}pt`;
  }
  return `${value > 0 ? '+' : ''}${value}${candidate.unit}`;
}

function windowLabel(window) {
  if (!window?.fromDateKey || !window?.toDateKey) return '比較期間なし';
  return `${formatShortDateLabel(window.fromDateKey)}〜${formatShortDateLabel(window.toDateKey)}`;
}

export function ContextShiftPanel({ summary }) {
  if (!summary) return null;
  if (!summary.available) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center gap-2 text-[10px] font-extrabold text-gray-600"><GitBranch className="h-3.5 w-3.5" />Context Shiftはまだ比較しません</div>
        <p className="mt-1 text-[9px] leading-relaxed text-gray-500">{summary.reason}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
      <div className="flex items-center gap-2 text-[10px] font-extrabold text-violet-700"><GitBranch className="h-3.5 w-3.5" />Context Shift候補 — 同時に変わっていた条件</div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">
        <div className="rounded-xl bg-white/80 p-2 text-gray-500"><div className="font-bold text-gray-600">以前の通常運用</div><div className="mt-0.5">{windowLabel(summary.previousWindow)}</div><div>失敗率 {percent(summary.previousWindow.failureRate)} ・ {summary.previousWindow.count}件 / {summary.previousWindow.weekCount}週</div></div>
        <div className="rounded-xl bg-white/80 p-2 text-gray-500"><div className="font-bold text-gray-600">直近の悪化期間</div><div className="mt-0.5">{windowLabel(summary.recentWindow)}</div><div>失敗率 {percent(summary.recentWindow.failureRate)} ・ {summary.recentWindow.count}件 / {summary.recentWindow.weekCount}週</div></div>
      </div>

      <p className="mt-2 text-[9px] leading-relaxed text-violet-700">{summary.reason}</p>

      {summary.candidates.length > 0 ? (
        <div className="mt-3 space-y-2">
          {summary.candidates.map((candidate) => (
            <div key={candidate.id} className="rounded-xl bg-white p-3">
              <div className="flex items-start justify-between gap-2"><div className="text-[10px] font-extrabold text-gray-700">{candidate.label}</div><div className="shrink-0 rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-600">{differenceText(candidate)}</div></div>
              <div className="mt-1 text-[10px] font-bold text-gray-600">{valueText(candidate, candidate.previousValue)} → {valueText(candidate, candidate.recentValue)}</div>
              <div className="mt-1 text-[8px] text-gray-400">比較サンプル: 以前 {candidate.previousSampleCount} / 直近 {candidate.recentSampleCount}</div>
              <p className="mt-1 text-[8px] leading-relaxed text-gray-400">{candidate.note}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-white p-3 text-[9px] leading-relaxed text-gray-500">記録済みの条件では、設定した最小差を超える変化は見つかりませんでした。未記録の要因が存在する可能性は残ります。</div>
      )}

      <p className="mt-3 border-t border-violet-100 pt-2 text-[8px] leading-relaxed text-violet-500">ここに出るのは同じ時期に変化していた条件です。「この条件が効果低下を起こした」という因果判定ではありません。睡眠・天候・人間関係など記録していない要因は推測しません。</p>
    </div>
  );
}
