import { useState } from 'react';
import { Activity, Layers, Sparkles } from 'lucide-react';
import { formatTime } from '../utils/schedule.js';
import { InsightCandidatesView } from './InsightCandidatesView.jsx';
import { MonthlyAnalyticsView } from './MonthlyAnalyticsView.jsx';
import { WeeklyAnalyticsView } from './WeeklyAnalyticsView.jsx';

export function AnalyticsView({
  stats,
  weeklyInsights,
  monthlyInsights,
  longitudinalInsights,
  experiments,
  days,
  selectedDate,
  onChangeDate,
  onStartExperiment,
  onStartRevalidation,
  onCaptureTrial,
  onRemoveTrial,
  onFinishExperiment,
  onAbandonExperiment,
  onDeleteExperiment,
}) {
  const [scope, setScope] = useState('day');

  return (
    <div className="animate-fade-in space-y-4 pt-4">
      <div className="grid grid-cols-4 rounded-2xl bg-gray-100 p-1" role="group" aria-label="分析期間">
        {[
          ['day', '日'],
          ['week', '週'],
          ['month', '月'],
          ['insights', '傾向'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setScope(value)}
            aria-pressed={scope === value}
            className={`rounded-xl py-2.5 text-sm font-bold transition ${scope === value ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {scope === 'day' && <DailyAnalyticsContent stats={stats} />}
      {scope === 'week' && <WeeklyAnalyticsView insights={weeklyInsights} selectedDate={selectedDate} onChangeDate={onChangeDate} />}
      {scope === 'month' && <MonthlyAnalyticsView insights={monthlyInsights} selectedDate={selectedDate} onChangeDate={onChangeDate} />}
      {scope === 'insights' && (
        <InsightCandidatesView
          insights={longitudinalInsights}
          experiments={experiments}
          days={days}
          selectedDate={selectedDate}
          onStartExperiment={onStartExperiment}
          onStartRevalidation={onStartRevalidation}
          onCaptureTrial={onCaptureTrial}
          onRemoveTrial={onRemoveTrial}
          onFinishExperiment={onFinishExperiment}
          onAbandonExperiment={onAbandonExperiment}
          onDeleteExperiment={onDeleteExperiment}
        />
      )}
    </div>
  );
}

function DailyAnalyticsContent({ stats }) {
  if (stats.total === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-indigo-200 bg-white p-8 text-center shadow-sm">
        <h2 className="mb-2 text-lg font-extrabold text-gray-800">この日に分析する予定がまだありません</h2>
        <p className="text-sm leading-relaxed text-gray-500">計画と実績がたまると、理想と現実の差や負荷の傾向がここに育っていきます。週・月・傾向タブには他の日の記録も含まれます。</p>
      </section>
    );
  }

  const allTimes = Object.values(stats.categories).flatMap((category) => [category.ideal, category.actual]);
  const maxTime = Math.max(...allTimes, 1);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-gray-800"><Layers className="h-5 w-5 text-indigo-500" aria-hidden="true" />理想の軌跡 vs 現実の歩み</h2>
        <p className="mb-5 text-xs leading-relaxed text-gray-500">予定外の行動も、実際に記録した時間だけを「現実の積み重ね」として可視化します。記録時の予定スナップショットがある実績は、その当時の理想を使います。</p>
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
    </div>
  );
}

function Bar({ label, percent, value, barClass, labelClass, valueClass, strong = false }) { return <div className="flex items-center gap-2"><span className={`w-6 text-[10px] ${strong ? 'font-bold' : ''} ${labelClass}`}>{label}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${percent}%` }} /></div><span className={`w-12 text-right text-xs ${strong ? 'font-bold' : 'font-medium'} ${valueClass}`}>{value}</span></div>; }
function Segment({ width, className, label, muted = false }) { return <div style={{ width: `${width * 100}%` }} className={`flex h-full items-center justify-center transition-all ${className}`}>{label && <span className={`px-1 text-xs ${muted ? 'font-medium text-gray-400' : 'font-bold text-white'}`}>{label}</span>}</div>; }
function SummaryCard({ label, value, tone }) { return <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-center"><div className="mb-1 text-xs font-medium text-gray-500">{label}</div><div className={`text-2xl font-black ${tone}`}>{value} <span className="text-sm font-medium text-gray-400">件</span></div></div>; }
