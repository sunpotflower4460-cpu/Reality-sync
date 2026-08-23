import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Frown,
  Smile,
} from 'lucide-react';
import { MOOD, STATUS } from '../constants.js';
import { formatShortDateLabel, formatWeekLabel, shiftDateKey } from '../utils/date.js';
import { formatTime } from '../utils/schedule.js';

function formatStartShift(value) {
  if (value === null || value === undefined) return '—';
  if (value === 0) return '±0分';
  return `${value > 0 ? '+' : ''}${value}分`;
}

function shiftTone(value) {
  if (value === null || value === undefined) return 'text-gray-400';
  if (Math.abs(value) <= 10) return 'text-green-600';
  if (Math.abs(value) <= 30) return 'text-amber-600';
  return 'text-orange-600';
}

function stressLabel(value) {
  return value === null || value === undefined ? '—' : String(value);
}

export function WeeklyAnalyticsView({ insights, selectedDate, onChangeDate }) {
  const hasWeekData = insights.totalSchedules > 0;
  const allCategoryTimes = Object.values(insights.categories).flatMap((category) => [category.ideal, category.actual]);
  const maxCategoryTime = Math.max(...allCategoryTimes, 1);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onChangeDate(shiftDateKey(selectedDate, -7))}
            aria-label="前の週へ"
            className="rounded-full bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 text-center">
            <div className="flex items-center justify-center gap-1.5 text-sm font-extrabold text-gray-800"><CalendarDays className="h-4 w-4 text-indigo-500" />週間レビュー</div>
            <div className="mt-1 text-xs font-medium text-gray-500">{formatWeekLabel(selectedDate)}</div>
          </div>
          <button
            type="button"
            onClick={() => onChangeDate(shiftDateKey(selectedDate, 7))}
            aria-label="次の週へ"
            className="rounded-full bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {!hasWeekData ? (
        <section className="rounded-3xl border border-dashed border-indigo-200 bg-white p-8 text-center shadow-sm">
          <h2 className="mb-2 text-lg font-extrabold text-gray-800">この週にはまだ予定がありません</h2>
          <p className="text-sm leading-relaxed text-gray-500">予定と実績が複数日にたまると、開始時刻のズレや曜日ごとの違いを比較できます。</p>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            <MetricCard label="記録率" value={`${insights.recordingRate}%`} detail={`${insights.recordedCount}/${insights.totalSchedules}件`} />
            <MetricCard label="予定通り率" value={`${insights.asPlannedRate}%`} detail="記録済みの中で" />
            <MetricCard label="理想時間" value={formatTime(insights.plannedMinutes)} detail={`${insights.daysWithPlans}日分`} />
            <MetricCard label="現実時間" value={formatTime(insights.actualMinutes)} detail="明示的な実績のみ" />
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-gray-800"><Clock3 className="h-5 w-5 text-indigo-500" />開始時刻のズレ</h2>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">プラスは予定より遅く、マイナスは早く始めた記録です。</p>
              </div>
              <div className="text-right">
                <div className={`text-xl font-black ${shiftTone(insights.averageStartDelta)}`}>{formatStartShift(insights.averageStartDelta)}</div>
                <div className="text-[10px] text-gray-400">平均</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <SmallStat label="平均絶対ズレ" value={insights.averageAbsoluteStartDelta === null ? '—' : `${insights.averageAbsoluteStartDelta}分`} />
              <SmallStat label="時刻サンプル" value={`${insights.startSampleCount}件`} />
            </div>
            {(insights.untimedStartCount > 0 || insights.ambiguousStartCount > 0) && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  開始時刻未記録 {insights.untimedStartCount}件
                  {insights.ambiguousStartCount > 0 ? `、深夜跨ぎの可能性があり方向を断定できない記録 ${insights.ambiguousStartCount}件` : ''} は平均から除外しています。
                </span>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-gray-800"><BarChart3 className="h-5 w-5 text-indigo-500" />この週の曜日別</h2>
            <p className="mb-4 text-xs leading-relaxed text-gray-500">1週間内の比較です。曜日そのものの傾向を断定するには、複数週のデータが必要です。</p>
            <div className="space-y-3">
              {insights.daily.map((day) => (
                <div key={day.dateKey} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="font-bold text-gray-700">{formatShortDateLabel(day.dateKey)}</div>
                    <div className="text-xs text-gray-500">記録 {day.recorded}/{day.total}件</div>
                  </div>
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${day.recordingRate}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                    <span>理想 {formatTime(day.plannedMinutes)}</span>
                    <span>現実 {formatTime(day.actualMinutes)}</span>
                    <span className={shiftTone(day.averageStartDelta)}>開始 {formatStartShift(day.averageStartDelta)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-gray-800"><Activity className="h-5 w-5 text-indigo-500" />カテゴリ別の理想 vs 現実</h2>
            <p className="mb-5 text-xs leading-relaxed text-gray-500">週全体で、予定した時間と実際に記録した時間を比較します。</p>
            <div className="space-y-5">
              {Object.entries(insights.categories).map(([category, data]) => (
                <div key={category} className="space-y-1.5">
                  <div className="text-sm font-bold text-gray-700">{category}</div>
                  <WeeklyBar label="理想" value={data.ideal} max={maxCategoryTime} className="bg-indigo-200" />
                  <WeeklyBar label="現実" value={data.actual} max={maxCategoryTime} className="bg-indigo-500" strong />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-base font-bold text-gray-800">変更・スキップの理由</h2>
            {insights.reasons.length === 0 ? (
              <p className="text-sm leading-relaxed text-gray-500">この週は理由付きの変更・スキップ記録がまだありません。</p>
            ) : (
              <div className="space-y-2">
                {insights.reasons.map(({ reason, count }, index) => (
                  <div key={reason} className="flex items-start gap-3 rounded-2xl bg-orange-50 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-orange-600 shadow-sm">{index + 1}</span>
                    <div className="min-w-0 flex-1 break-words text-sm font-medium text-gray-700">{reason}</div>
                    <span className="shrink-0 text-xs font-black text-orange-600">{count}件</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-gray-800">負荷と気分の観測</h2>
            <div className="grid grid-cols-3 gap-2">
              <OutcomeStress label="予定通り" value={insights.stressByStatus[STATUS.AS_PLANNED].average} />
              <OutcomeStress label="変更" value={insights.stressByStatus[STATUS.CHANGED].average} />
              <OutcomeStress label="スキップ" value={insights.stressByStatus[STATUS.SKIPPED].average} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MoodStat Icon={Smile} label="良い" value={insights.moodCounts[MOOD.GOOD]} />
              <MoodStat label="普通" value={insights.moodCounts[MOOD.NORMAL]} />
              <MoodStat Icon={Frown} label="疲れた" value={insights.moodCounts[MOOD.BAD]} />
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-gray-400">ここでは同じ週の記録を記述的に並べているだけで、負荷や気分が変更・スキップの原因だったとは断定しません。</p>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-black text-gray-800">{value}</div>
      <div className="mt-1 text-[10px] text-gray-400">{detail}</div>
    </div>
  );
}

function SmallStat({ label, value }) {
  return <div className="rounded-2xl bg-gray-50 p-3"><div className="text-[10px] font-bold text-gray-400">{label}</div><div className="mt-1 font-black text-gray-700">{value}</div></div>;
}

function WeeklyBar({ label, value, max, className, strong = false }) {
  const width = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className={`w-6 text-[10px] ${strong ? 'font-bold text-indigo-600' : 'text-gray-400'}`}>{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${className}`} style={{ width: `${width}%` }} /></div>
      <span className={`w-14 text-right text-xs ${strong ? 'font-bold text-indigo-600' : 'font-medium text-gray-500'}`}>{formatTime(value)}</span>
    </div>
  );
}

function OutcomeStress({ label, value }) {
  return <div className="rounded-2xl bg-indigo-50 p-3 text-center"><div className="text-[10px] font-bold text-indigo-400">{label}</div><div className="mt-1 text-xl font-black text-indigo-700">{stressLabel(value)}</div><div className="text-[9px] text-indigo-400">平均負荷</div></div>;
}

function MoodStat({ Icon, label, value }) {
  return <div className="rounded-2xl bg-gray-50 p-3 text-center">{Icon ? <Icon className="mx-auto mb-1 h-4 w-4 text-gray-400" /> : <div className="mx-auto mb-1 h-4 w-4 rounded-full border-2 border-gray-300" />}<div className="text-[10px] font-bold text-gray-400">{label}</div><div className="mt-1 text-lg font-black text-gray-700">{value}</div></div>;
}
