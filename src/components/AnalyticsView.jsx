import { useState } from 'react';
import { Activity, Layers, Sparkles } from 'lucide-react';
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
    <div className="animate-fade-in space-y-5 pt-4">
      <div className="px-1">
        <p className="text-[10px] font-black tracking-[0.16em] text-indigo-500">REFLECT</p>
        <h2 className="mt-1 text-[1.35rem] font-black tracking-tight text-slate-900">理想と現実を見比べる</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">良し悪しではなく、次の予定を少し現実に近づけるために</p>
      </div>

      <DailyAnalyticsContent stats={stats} />
      <SimpleInsightCard insights={longitudinalInsights} />

      <details className="app-card rounded-2xl">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-extrabold text-slate-500">
          <span>週・月の振り返り</span><span className="text-[10px] font-bold text-slate-300">詳しく見る</span>
        </summary>
        <div className="border-t border-slate-100 p-3">
          <div className="mb-3 grid grid-cols-2 rounded-xl bg-slate-100/80 p-1" role="group" aria-label="振り返り期間">
            <button type="button" onClick={() => setDetailScope('week')} aria-pressed={detailScope === 'week'} className={`min-h-10 rounded-lg px-3 text-xs font-extrabold transition ${detailScope === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>週</button>
            <button type="button" onClick={() => setDetailScope('month')} aria-pressed={detailScope === 'month'} className={`min-h-10 rounded-lg px-3 text-xs font-extrabold transition ${detailScope === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>月</button>
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
      <section className="app-card rounded-2xl p-4">
        <div className="flex items-center gap-2 text-sm font-black text-slate-800"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50"><Sparkles className="h-4 w-4 text-indigo-500" /></span>記録からの気づき</div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">記録がたまると、次の予定を少し現実に近づけるための気づきをここに1つだけ表示します。</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-[0_8px_28px_rgba(79,70,229,0.06)]">
      <div className="flex items-center gap-2 text-sm font-black text-indigo-900"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm"><Sparkles className="h-4 w-4 text-indigo-500" /></span>記録からの気づき</div>
      <h3 className="mt-3 text-sm font-black leading-relaxed text-slate-800">{candidate.title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{candidate.observation}</p>
      <p className="mt-3 border-t border-indigo-100/70 pt-3 text-[10px] leading-relaxed text-slate-400">断定ではなく、次の予定を考える時の小さなヒントとして扱います。</p>
    </section>
  );
}

function DailyAnalyticsContent({ stats }) {
  if (stats.total === 0) {
    return (
      <section className="app-card-strong rounded-[1.75rem] p-7 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500"><Layers className="h-5 w-5" /></div>
        <h2 className="mt-4 text-base font-black text-slate-800">まだ比べる予定がありません</h2>
        <p className="mx-auto mt-2 max-w-[17rem] text-xs leading-relaxed text-slate-500">予定と実績がそろうと、理想と現実の違いがここに見えてきます。</p>
      </section>
    );
  }

  const allTimes = Object.values(stats.categories).flatMap((category) => [category.ideal, category.actual]);
  const maxTime = Math.max(...allTimes, 1);

  return (
    <div className="space-y-4">
      <section className="app-card-strong rounded-[1.55rem] p-4.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black tracking-[0.12em] text-indigo-400">TODAY</p>
            <h2 className="mt-1 flex items-center gap-2 text-base font-black text-slate-800"><Activity className="h-4.5 w-4.5 text-indigo-500" aria-hidden="true" />予定の達成度サマリー</h2>
            <p className="mt-1 text-[10px] text-slate-400">うまくいかなかったことも、次の計画の材料</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[2rem] font-black leading-none tracking-tight text-indigo-600">{stats.completionRate}<span className="ml-0.5 text-sm">%</span></div>
            <div className="mt-1 text-[8px] font-extrabold text-slate-400">予定通り</div>
          </div>
        </div>

        <div className="mt-4 flex h-3.5 overflow-hidden rounded-full bg-slate-100">
          <Segment width={stats.completed / Math.max(stats.total, 1)} className="bg-emerald-500" />
          <Segment width={stats.changed / Math.max(stats.total, 1)} className="bg-amber-400" />
          <Segment width={stats.skipped / Math.max(stats.total, 1)} className="bg-rose-400" />
          <Segment width={stats.pending / Math.max(stats.total, 1)} className="bg-slate-200" muted />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="予定通り" value={stats.completed} tone="text-emerald-600" />
          <MiniStat label="変更・休み" value={stats.changed + stats.skipped} tone="text-amber-600" />
          <MiniStat label="未記録" value={stats.pending} tone="text-slate-500" />
        </div>
      </section>

      <section className="app-card rounded-[1.55rem] p-4">
        <h2 className="flex items-center gap-2 text-base font-black text-slate-800"><Layers className="h-5 w-5 text-indigo-500" aria-hidden="true" />理想の軌跡 vs 現実の歩み</h2>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">実際に記録した時間だけを「現実」として比べます。</p>
        <div className="mt-5 space-y-5">
          {Object.entries(stats.categories).map(([category, data]) => {
            const idealPercent = (data.ideal / maxTime) * 100;
            const actualPercent = (data.actual / maxTime) * 100;
            const unexpectedGain = data.ideal === 0 && data.actual > 0;
            return (
              <div key={category} className="space-y-1.5">
                <div className="flex items-center gap-2"><div className="truncate text-sm font-black text-slate-700">{category}</div>{unexpectedGain && <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-pink-50 px-2 py-0.5 text-[9px] font-extrabold text-pink-600"><Sparkles className="h-3 w-3" />予定外</span>}</div>
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
  return <div className="flex items-center gap-2"><span className={`w-6 text-[9px] ${strong ? 'font-extrabold' : 'font-semibold'} ${labelClass}`}>{label}</span><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${percent}%` }} /></div><span className={`w-12 text-right text-[11px] ${strong ? 'font-extrabold' : 'font-semibold'} ${valueClass}`}>{value}</span></div>;
}
function Segment({ width, className }) { return <div style={{ width: `${width * 100}%` }} className={`h-full transition-all ${className}`} />; }
function MiniStat({ label, value, tone }) { return <div className="rounded-xl bg-slate-50 px-2 py-2.5"><div className="text-[8px] font-extrabold text-slate-400">{label}</div><div className={`mt-1 text-lg font-black ${tone}`}>{value}<span className="ml-0.5 text-[9px] font-semibold text-slate-400">件</span></div></div>; }
