import { Activity, Heart, Layers, Lock, Sparkles } from 'lucide-react';

const formatTime = (minutes) => {
  if (!minutes) return '0分';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h${rest}m`;
  return hours ? `${hours}h` : `${rest}m`;
};

export default function AnalyticsView({ stats }) {
  const allTimes = Object.values(stats.categories).flatMap((category) => [category.ideal, category.actual]);
  const maxTime = Math.max(...allTimes, 1);

  return (
    <div className="space-y-6 pt-4 animate-in">
      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-gray-800"><Layers className="h-5 w-5 text-indigo-500" />理想の軌跡 vs 現実の歩み</h2>
        <p className="mb-5 text-xs leading-relaxed text-gray-500">「予定外の読書」や「思いがけないリフレッシュ」など、理想にはなかったけれど現実で積み重なった事実も可視化します。</p>
        <div className="space-y-5">
          {Object.entries(stats.categories).map(([category, data]) => {
            const unexpected = data.ideal === 0 && data.actual > 0;
            return (
              <div key={category} className="space-y-1.5">
                <div className="flex items-center gap-2"><span className="text-sm font-bold text-gray-700">{category}</span>{unexpected && <span className="flex items-center gap-0.5 rounded-full bg-pink-100 px-1.5 py-0.5 text-[9px] font-bold text-pink-600"><Sparkles className="h-3 w-3" />予定外の積み重ね</span>}</div>
                <Bar label="理想" value={data.ideal} max={maxTime} />
                <Bar label="現実" value={data.actual} max={maxTime} highlight={unexpected} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-800"><Activity className="h-5 w-5 text-indigo-500" />予定の達成度サマリー</h2>
          <span className="text-2xl font-black text-indigo-600">{stats.completionRate}%</span>
        </div>
        <div className="mb-4 flex h-12 overflow-hidden rounded-xl border border-gray-100 shadow-inner">
          <Segment count={stats.completed} total={stats.total} className="bg-green-500" label="予定通り" />
          <Segment count={stats.changed} total={stats.total} className="bg-orange-400" label="変更" />
          <Segment count={stats.skipped} total={stats.total} className="bg-red-400" label="休" />
          <Segment count={stats.pending} total={stats.total} className="bg-gray-100 text-gray-400" label="未定" />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Summary label="予定通り実行" value={stats.completed} className="text-green-600" />
          <Summary label="変更・スキップ" value={stats.changed + stats.skipped} className="text-orange-600" />
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <Heart className="absolute right-4 top-4 h-24 w-24 text-pink-500 opacity-10" />
        <div className="relative z-10">
          <h2 className="mb-2 text-lg font-extrabold text-gray-800">習慣のシナジー効果</h2>
          <p className="mb-6 text-sm text-gray-600">記録を蓄積し、特定の習慣が他の活動に与える影響や、ストレス蓄積のパターンを分析します。</p>
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center">
            <div className="mb-3 rounded-full bg-white p-3 text-gray-400 shadow-sm"><Lock className="h-8 w-8" /></div>
            <h3 className="mb-1 font-bold text-gray-700">データを蓄積中です</h3>
            <p className="px-4 text-xs text-gray-500">分析には数日分の記録が必要です。</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Bar({ label, value, max, highlight = false }) {
  const percent = (value / max) * 100;
  return <div className="flex items-center gap-2"><span className={`w-6 text-[10px] ${highlight ? 'font-bold text-pink-500' : label === '現実' ? 'font-bold text-indigo-600' : 'text-gray-400'}`}>{label}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${highlight ? 'bg-pink-400' : label === '現実' ? 'bg-indigo-500' : 'bg-indigo-200'}`} style={{ width: `${percent}%` }} /></div><span className={`w-10 text-right text-xs ${highlight ? 'font-bold text-pink-500' : label === '現実' ? 'font-bold text-indigo-600' : 'font-medium text-gray-500'}`}>{formatTime(value)}</span></div>;
}

function Segment({ count, total, className, label }) {
  if (!count) return <div style={{ width: `${(count / Math.max(total, 1)) * 100}%` }} />;
  return <div style={{ width: `${(count / Math.max(total, 1)) * 100}%` }} className={`flex h-full items-center justify-center ${className}`}><span className="px-1 text-xs font-bold text-white">{label}</span></div>;
}

function Summary({ label, value, className }) {
  return <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-center"><div className="mb-1 text-xs font-medium text-gray-500">{label}</div><div className={`text-2xl font-black ${className}`}>{value} <span className="text-sm font-medium text-gray-400">件</span></div></div>;
}
