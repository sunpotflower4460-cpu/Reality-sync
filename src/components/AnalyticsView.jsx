import { useState } from 'react';
import { Activity, ChevronDown, Layers, Sparkles } from 'lucide-react';
import { formatTime } from '../utils/schedule.js';
import { MonthlyAnalyticsView } from './MonthlyAnalyticsView.jsx';
import { WeeklyAnalyticsView } from './WeeklyAnalyticsView.jsx';

export function AnalyticsView({
  stats,
  weeklyInsights,
  monthlyInsights,
  longitudinalInsights,
  selectedDate,
  onChangeDate,
}) {
  const [detailScope, setDetailScope] = useState('week');

  return (
    <div className="animate-fade-in space-y-3.5 pt-3.5">
      <div className="px-0.5">
        <p className="text-[8px] font-semibold tracking-[0.16em] text-indigo-500">REFLECT</p>
        <h2 className="mt-1 text-[1.2rem] font-semibold tracking-[-0.025em] text-slate-900">理想と現実を見比べる</h2>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">良し悪しではなく、次の予定を少し現実に近づけるために</p>
      </div>

      <DailyAnalyticsContent stats={stats} />
      <SimpleInsightCard insights={longitudinalInsights} />

      <details className="app-group group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[10px] font-medium text-slate-500">
          <span>週・月の振り返り</span><span className="flex items-center gap-1.5 text-[8px] font-medium text-slate-300">詳しく見る<ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" /></span>
        </summary>
        <div className="border-t border-slate-100 p-3">
          <div className="mb-3 grid grid-cols-2 rounded-xl bg-slate-100/85 p-1" role="group" aria-label="振り返り期間">
            <button type="button" onClick={() => setDetailScope('week')} aria-pressed={detailScope === 'week'} className={`min-h-9 rounded-lg px-3 text-[10px] font-semibold transition ${detailScope === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>週</button>
            <button type="button" onClick={() => setDetailScope('month')} aria-pressed={detailScope === 'month'} className={`min-h-9 rounded-lg px-3 text-[10px] font-semibold transition ${detailScope === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>月</button>
          </div>
          {detailScope === 'week' && <WeeklyAnalyticsView insights={weeklyInsights} selectedDate={selectedDate} onChangeDate={onChangeDate} />}
          {detailScope === 'month' && <MonthlyAnalyticsView insights={monthlyInsights} selectedDate={selectedDate} onChangeDate={onChangeDate} />}
        </div>
      </details>
    </div>
  );
}

function SimpleInsightCard({ insights }) {
  const candidate = insights?.candidates?.[0] ?? null;
  if (!candidate) {
    return (
      <section className="app-group flex items-start gap-3 p-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50"><Sparkles className="h-4 w-4 text-indigo-500" /></span>
        <div><div className="text-[11px] font-semibold text-slate-800">記録からの気づき</div><p className="mt-1 text-[9px] leading-relaxed text-slate-500">記録がたまると、次の予定に使える気づきをここに1つだけ表示します。</p></div>
      </section>
    );
  }

  return (
    <section className="app-group p-3.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-800"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50"><Sparkles className="h-4 w-4 text-indigo-500" /></span>記録からの気づき</div>
      <h3 className="mt-2.5 text-[12px] font-semibold leading-relaxed text-slate-800">{candidate.title}</h3>
      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">{candidate.observation}</p>
      <p className="mt-2.5 border-t border-slate-100 pt-2.5 text-[8px] leading-relaxed text-slate-400">断定ではなく、次の予定を考える時の小さなヒントとして扱います。</p>
    </section>
  );
}

function DailyAnalyticsContent({ stats }) {
  if (stats.total === 0) {
    return (
      <section className="app-card-strong rounded-[1.25rem] p-5 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500"><Layers className="h-4.5 w-4.5" /></div>
        <h2 className="mt-3.5 text-[15px] font-semibold text-slate-800">まだ比べる予定がありません</h2>
        <p className="mx-auto mt-1.5 max-w-[17rem] text-[11px] leading-relaxed text-slate-500">予定と実績がそろうと、理想と現実の違いがここに見えてきます。</p>
      </section>
    );
  }

  const allTimes = Object.values(stats.categories).flatMap((category) => [category.ideal, category.actual]);
  const maxTime = Math.max(...allTimes, 1);

  return (
    <div className="space-y-3">
      <section className="app-card-strong rounded-[1.15rem] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[8px] font-semibold tracking-[0.12em] text-indigo-400">DAY</p>
            <h2 className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-slate-800"><Activity className="h-4 w-4 text-indigo-500" aria-hidden="true" />この日の記録</h2>
            <p className="mt-1 text-[8px] text-slate-400">結果ではなく、次の予定の材料</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[17px] font-semibold leading-none text-slate-800">{stats.completed}<span className="mx-0.5 text-[10px] font-normal text-slate-300">/</span><span className="text-[12px] font-medium text-slate-500">{stats.total}</span></div>
            <div className="mt-1 text-[8px] font-medium text-indigo-500">予定通り {stats.completionRate}%</div>
          </div>
        </div>

        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
          <Segment width={stats.completed / Math.max(stats.total, 1)} className="bg-emerald-500" />
          <Segment width={stats.changed / Math.max(stats.total, 1)} className="bg-amber-400" />
          <Segment width={stats.skipped / Math.max(stats.total, 1)} className="bg-rose-400" />
          <Segment width={stats.pending / Math.max(stats.total, 1)} className="bg-slate-200" />
        </div>
        <div className="mt-2.5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50/75 py-2">
          <MiniStat label="予定通り" value={stats.completed} tone="text-emerald-600" />
          <MiniStat label="変更・休み" value={stats.changed + stats.skipped} tone="text-amber-600" />
          <MiniStat label="未記録" value={stats.pending} tone="text-slate-500" />
        </div>
      </section>

      <section className="app-group p-3.5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-slate-800"><Layers className="h-4 w-4 text-indigo-500" aria-hidden="true" />理想と現実の時間</h2>
        <p className="mt-1 text-[9px] leading-relaxed text-slate-500">実際に記録した時間だけを「現実」として比べます。</p>
        {stats.unknownActualDurationCount > 0 && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[8px] leading-relaxed text-amber-700">実時間が未記録の実績 {stats.unknownActualDurationCount}件は、0分とみなさず時間集計から除外しています。</p>}
        <div className="mt-3.5 space-y-3">
          {Object.entries(stats.categories).map(([category, data]) => {
            const idealPercent = (data.ideal / maxTime) * 100;
            const actualPercent = (data.actual / maxTime) * 100;
            const unexpectedGain = data.ideal === 0 && data.actual > 0;
            return (
              <div key={category} className="space-y-1.25">
                <div className="flex items-center gap-2"><div className="truncate text-[11px] font-semibold text-slate-700">{category}</div>{unexpectedGain && <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-pink-50 px-1.5 py-0.5 text-[7px] font-semibold text-pink-600"><Sparkles className="h-2.5 w-2.5" />予定外</span>}</div>
                <Bar label="理想" percent={idealPercent} value={formatTime(data.ideal)} barClass="bg-indigo-200" labelClass="text-slate-400" valueClass="text-slate-500" />
                <Bar label="現実" percent={actualPercent} value={formatTime(data.actual)} barClass={unexpectedGain ? 'bg-pink-400' : 'bg-indigo-600'} labelClass={unexpectedGain ? 'text-pink-500' : 'text-indigo-600'} valueClass={unexpectedGain ? 'text-pink-500' : 'text-indigo-600'} strong />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Bar({ label, percent, value, barClass, labelClass, valueClass, strong = false }) {
  return <div className="flex items-center gap-2"><span className={`w-6 text-[8px] ${strong ? 'font-semibold' : 'font-medium'} ${labelClass}`}>{label}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${percent}%` }} /></div><span className={`w-11 text-right text-[9px] ${strong ? 'font-semibold' : 'font-medium'} ${valueClass}`}>{value}</span></div>;
}
function Segment({ width, className }) { return <div style={{ width: `${width * 100}%` }} className={`h-full transition-all ${className}`} />; }
function MiniStat({ label, value, tone }) { return <div className="px-2 text-center"><div className="text-[7px] font-medium text-slate-400">{label}</div><div className={`mt-0.5 text-[14px] font-semibold ${tone}`}>{value}<span className="ml-0.5 text-[7px] font-medium text-slate-400">件</span></div></div>; }
