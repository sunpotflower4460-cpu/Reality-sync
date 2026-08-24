import { GitBranch } from 'lucide-react';
import { calculateContextShiftSummaries } from '../utils/contextShift.js';
import { ContextShiftPanel } from './ContextShiftPanel.jsx';

export function ContextShiftReviewSection({ experiments = [], days = {}, throughDateKey }) {
  const summaries = calculateContextShiftSummaries(experiments, days, throughDateKey);
  if (summaries.length === 0) return null;
  const byId = new Map(experiments.map((experiment) => [experiment.id, experiment]));

  return (
    <section className="space-y-3">
      <div className="px-1">
        <div className="flex items-center gap-2 font-extrabold text-gray-800"><GitBranch className="h-5 w-5 text-violet-500" />学びが効きにくくなった時、何が一緒に変わった？</div>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-400">再検証候補になった現在の学びだけについて、以前の通常運用期と直近悪化期の明示記録を比較します。原因推定ではなく、次に確認するContext Shift候補です。</p>
      </div>
      {summaries.map((summary) => {
        const experiment = byId.get(summary.experimentId);
        if (!experiment) return null;
        return (
          <article key={summary.experimentId} className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-600">v{experiment.learningVersion || 1}</span><h3 className="min-w-0 truncate text-xs font-extrabold text-gray-800">{experiment.title}</h3></div>
            <ContextShiftPanel summary={summary} />
          </article>
        );
      })}
    </section>
  );
}
