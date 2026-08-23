import { Activity, Heart, Layers, Lock, Sparkles } from 'lucide-react';
import { formatTime } from '../utils/schedule.js';

export function AnalyticsView({ stats }) {
  if (stats.total === 0) {
    return (
      <div className="animate-fade-in pt-4">
        <section className="rounded-3xl border border-dashed border-indigo-200 bg-white p-8 text-center shadow-sm">
          <h2 className="mb-2 text-lg font-extrabold text-gray-800">分析する予定がまだありません</h2>
          <p className="text-sm leading-relaxed text-gray-500">計画と実績がたまると、理想と現実の差や負荷の傾向がここに育っていきます。</p>
        </section>
      </div>
    );
  }

  const allTimes = Object.values(stats.categories).flatMap((category) => [category.ideal, category.actual]);
  const maxTime = Math.max(...allTimes, 1);

  return (
    <div className="animate-fade-in space-y-6 pt-4">
      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-gray-800"><Layers className="h-5 w-5 text-indigo-500" aria-hidden="true" />理想の軌跡 vs 現実の歩み</h2>
        <p className="mb-5 text-xs leading-relaxed text-gray-500">予定外の行動も、実際に記録した時間だけを「現実の積み重ね」として可視化します。</p>
        <div className="space-y-5">
          {Object.entries(stats.categories).map(([category, data]) => {
            const idealPercent = (data.ideal / maxTime) * 100;
            const actualPercent = (data.actual / maxTime) * 100;
            const unexpectedGain = data.ideal === 0 && data.actual > 0;
            return (
              <div key={category} className="space-y-1.5">
                <div className="flex items-center gap-2"><div className="text-sm font-bold text-gray-700">{category}</div>{unexpectedGain && <span className="flex items-center gap-0.5 rounded-full bg-pink-100 px-1.5 py-0.5 text-[9px] font-bold text-pink-600"><Sparkles className="h-3 w-3" />予定外の積み重ね</span>}</div>
                <Bar label="理想" percent={idealPercent} value={formatTime(data.ideal)} barClass="bg-indigo-200" labelClass="text-gray-400" valueClass="text-gray-500" />
                <Bar label="現実" percent={actualPercent} value={formatTime(data.actual)} barClass={unexpectedGain ? 'bg-pink-400' : 'bg-indigo-500'} labelClass={unexpectedGain ? 'text-pink-500' : 'text-indigo-600'} valueClass={unexpectedGain ? 'text-pink-500' : 'text-indigo-600'} strong />
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3"><h2 className="flex items-center gap-2 text-base font-bold text-gray-800"><Activity className="h-5 w-5 text-indigo-500" aria-hidden="true" />予定の達成度サマリー</h2><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-600">{stats.completionRate}%</span></div>
        <div className="mb-4 flex h-12 overflow-hidden rounded-xl border border-gray-100 shadow-inner">
          <Segment width={stats.completed / Math.max(stats.total, 1)} className="bg-green-500" label={stats.completed > 0 ? '予定通り' : ''} />
          <Segment width={stats.changed / Math.max(stats.total, 1)} className="bg-orange-400" label={stats.changed > 0 ? '変更' : ''} />
          <Segment width={stats.skipped / Math.max(stats.total, 1)} className="bg-red-400" label={stats.skipped > 0 ? '休' : ''} />
          <Segment width={stats.pending / Math.max(stats.total, 1)} className="bg-gray-100" label={stats.pending > 0 ? '未定' : ''} muted />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm"><SummaryCard label="予定通り実行" value={stats.completed} tone="text-green-600" /><SummaryCard label="変更・スキップ" value={stats.changed + stats.skipped} tone="text-orange-600" /></div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <Heart className="absolute right-4 top-4 h-24 w-24 text-pink-500 opacity-10" aria-hidden="true" />
        <div className="relative z-10"><h2 className="mb-2 text-lg font-extrabold text-gray-800">習慣のシナジー効果</h2><p className="mb-6 text-sm text-gray-600">記録を蓄積し、特定の習慣が他の活動に与える影響や、ストレス蓄積のパターンを分析します。</p><div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center"><div className="mb-3 rounded-full bg-white p-3 text-gray-400 shadow-sm"><Lock className="h-8 w-8" /></div><h3 className="mb-1 font-bold text-gray-700">データを蓄積中です</h3><p className="px-4 text-xs text-gray-500">相関を語るには、複数日ぶんの記録が必要です。</p></div></div>
      </section>
    </div>
  );
}

function Bar({ label, percent, value, barClass, labelClass, valueClass, strong = false }) {
  return <div className="flex items-center gap-2"><span className={`w-6 text-[10px] ${strong ? 'font-bold' : ''} ${labelClass}`}>{label}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${percent}%` }} /></div><span className={`w-12 text-right text-xs ${strong ? 'font-bold' : 'font-medium'} ${valueClass}`}>{value}</span></div>;
}

function Segment({ width, className, label, muted = false }) {
  return <div style={{ width: `${width * 100}%` }} className={`flex h-full items-center justify-center transition-all ${className}`}>{label && <span className={`px-1 text-xs ${muted ? 'font-medium text-gray-400' : 'font-bold text-white'}`}>{label}</span>}</div>;
}

function SummaryCard({ label, value, tone }) {
  return <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-center"><div className="mb-1 text-xs font-medium text-gray-500">{label}</div><div className={`text-2xl font-black ${tone}`}>{value} <span className="text-sm font-medium text-gray-400">件</span></div></div>;
}
