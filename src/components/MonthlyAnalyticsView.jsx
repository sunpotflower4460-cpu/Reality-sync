import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  TrendingUp,
} from 'lucide-react';
import { dateKeyFromDate, formatMonthLabel, formatShortDateLabel, shiftMonthDateKey, startOfMonthDateKey } from '../utils/date.js';
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

export function MonthlyAnalyticsView({ insights, selectedDate, onChangeDate }) {
  const hasData = insights.totalSchedules > 0;
  const futureMonth = startOfMonthDateKey(selectedDate) > dateKeyFromDate();
  const categoryValues = Object.values(insights.categories).flatMap((category) => [category.ideal, category.actual]);
  const maxCategory = Math.max(...categoryValues, 1);
  const weekValues = insights.weeks.flatMap((week) => [week.plannedMinutes, week.actualMinutes]);
  const maxWeek = Math.max(...weekValues, 1);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => onChangeDate(shiftMonthDateKey(selectedDate, -1))} aria-label="前の月へ" className="rounded-full bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200"><ChevronLeft className="h-5 w-5" /></button>
          <div className="min-w-0 text-center"><div className="flex items-center justify-center gap-1.5 text-sm font-extrabold text-gray-800"><CalendarRange className="h-4 w-4 text-indigo-500" />月間レビュー</div><div className="mt-1 text-xs font-medium text-gray-500">{formatMonthLabel(selectedDate)}</div></div>
          <button type="button" onClick={() => onChangeDate(shiftMonthDateKey(selectedDate, 1))} aria-label="次の月へ" className="rounded-full bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </section>

      {!hasData ? (
        futureMonth ? (
          <section className="rounded-3xl border border-dashed border-indigo-200 bg-white p-8 text-center shadow-sm"><h2 className="mb-2 text-lg font-extrabold text-gray-800">この月の現実はまだ観測前です</h2><p className="text-sm leading-relaxed text-gray-500">未来の月は、保存済みの予定があっても「未記録」として数えません。月が始まると観測できる範囲だけを集計します。</p></section>
        ) : (
          <section className="rounded-3xl border border-dashed border-indigo-200 bg-white p-8 text-center shadow-sm"><h2 className="mb-2 text-lg font-extrabold text-gray-800">この月にはまだ予定がありません</h2><p className="text-sm leading-relaxed text-gray-500">複数週ぶんの計画と実績がたまると、週ごとの変化や曜日ごとの観測傾向を比較できます。</p></section>
        )
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            <MetricCard label="記録率" value={`${insights.recordingRate}%`} detail={`${insights.recordedCount}/${insights.totalSchedules}件`} />
            <MetricCard label="予定通り率" value={`${insights.asPlannedRate}%`} detail="記録済みの中で" />
            <MetricCard label="理想時間" value={formatTime(insights.plannedMinutes)} detail={`${insights.daysWithPlans}日分`} />
            <MetricCard label="現実時間" value={formatTime(insights.actualMinutes)} detail={`${insights.daysWithRecords}日で記録`} />
          </section>

          {insights.legacyPlannedCount > 0 && <LegacyPlanNotice count={insights.legacyPlannedCount} />}

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><h2 className="flex items-center gap-2 text-base font-bold text-gray-800"><Clock3 className="h-5 w-5 text-indigo-500" />月間の開始日時ズレ</h2><p className="mt-1 text-xs leading-relaxed text-gray-500">開始日と時刻が明示され、予定日から前後1日以内の記録だけで計算します。深夜跨ぎは日付を使って正確に扱います。</p></div>
              <div className="text-right"><div className={`text-xl font-black ${shiftTone(insights.averageStartDelta)}`}>{formatStartShift(insights.averageStartDelta)}</div><div className="text-[10px] text-gray-400">平均</div></div>
            </div>
            <div className="grid grid-cols-2 gap-3"><SmallStat label="平均絶対ズレ" value={insights.averageAbsoluteStartDelta === null ? '—' : `${insights.averageAbsoluteStartDelta}分`} /><SmallStat label="日時サンプル" value={`${insights.startSampleCount}件`} /></div>
            {(insights.untimedStartCount > 0 || insights.undatedStartCount > 0 || insights.distantStartCount > 0) && <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>開始ズレから除外: 開始時刻未記録 {insights.untimedStartCount}件、開始日不明 {insights.undatedStartCount}件、予定日から前後1日より遠い開始 {insights.distantStartCount}件。</span></div>}
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-gray-800"><TrendingUp className="h-5 w-5 text-indigo-500" />週ごとの推移</h2>
            <p className="mb-4 text-xs leading-relaxed text-gray-500">月内の日だけを、その日が属する月曜始まりの週にまとめています。</p>
            <div className="space-y-4">
              {insights.weeks.map((week) => (
                <div key={week.weekStart} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-bold text-gray-700">{formatShortDateLabel(week.weekStart)}〜</span><span className="text-xs font-bold text-indigo-600">記録率 {week.recordingRate}%</span></div>
                  <RangeBar label="理想" value={week.plannedMinutes} max={maxWeek} className="bg-indigo-200" />
                  <RangeBar label="現実" value={week.actualMinutes} max={maxWeek} className="bg-indigo-500" strong />
                  <div className="mt-2 text-[10px] text-gray-400">記録 {week.recorded}/{week.total}件 ・ 予定通り率 {week.asPlannedRate}%</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-gray-800"><BarChart3 className="h-5 w-5 text-indigo-500" />曜日ごとの観測</h2>
            <p className="mb-4 text-xs leading-relaxed text-gray-500">この月に複数回あった同じ曜日をまとめた記述的な比較です。曜日が原因だとは断定しません。</p>
            <div className="grid grid-cols-1 gap-3">
              {insights.weekdays.map((weekday) => (
                <div key={weekday.label} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3"><div className="flex items-baseline gap-2"><span className="text-lg font-black text-gray-800">{weekday.label}</span><span className="text-[10px] text-gray-400">計画あり {weekday.daysWithPlans}/{weekday.calendarDays}日</span></div><span className="text-xs font-bold text-indigo-600">記録率 {weekday.recordingRate}%</span></div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <TinyStat label="予定通り" value={`${weekday.asPlannedRate}%`} />
                    <TinyStat label="現実時間" value={formatTime(weekday.actualMinutes)} />
                    <TinyStat label="開始平均" value={formatStartShift(weekday.averageStartDelta)} tone={shiftTone(weekday.averageStartDelta)} />
                  </div>
                  <p className="mt-2 text-[9px] leading-relaxed text-gray-400">開始日時サンプル {weekday.startSampleCount}件。サンプルが少ない曜日は傾向判断に使わず、観測値としてのみ表示します。</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-base font-bold text-gray-800">カテゴリ別の月間 理想 vs 現実</h2>
            <div className="space-y-5">{Object.entries(insights.categories).map(([category, data]) => <div key={category} className="space-y-1.5"><div className="text-sm font-bold text-gray-700">{category}</div><RangeBar label="理想" value={data.ideal} max={maxCategory} className="bg-indigo-200" /><RangeBar label="現実" value={data.actual} max={maxCategory} className="bg-indigo-500" strong /></div>)}</div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-base font-bold text-gray-800">月間の変更・スキップ理由</h2>
            {insights.reasons.length === 0 ? <p className="text-sm leading-relaxed text-gray-500">理由付きの変更・スキップ記録はまだありません。</p> : <div className="space-y-2">{insights.reasons.slice(0, 8).map(({ reason, count }, index) => <div key={reason} className="flex items-start gap-3 rounded-2xl bg-orange-50 p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-orange-600 shadow-sm">{index + 1}</span><div className="min-w-0 flex-1 break-words text-sm font-medium text-gray-700">{reason}</div><span className="shrink-0 text-xs font-black text-orange-600">{count}件</span></div>)}</div>}
            <p className="mt-4 text-[11px] leading-relaxed text-gray-400">理由・曜日・負荷・気分の同時発生は観測できますが、この画面だけで因果関係は判断しません。</p>
          </section>
        </>
      )}
    </div>
  );
}

function LegacyPlanNotice({ count }) { return <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>記録時の予定スナップショットがない旧実績が {count}件あります。これらの理想側は現在保存されている予定を表示しており、過去の計画を推測復元したものではありません。計画内容を使う「傾向」分析からは除外します。</span></div>; }
function MetricCard({ label, value, detail }) { return <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><div className="text-xs font-bold text-gray-400">{label}</div><div className="mt-1 text-2xl font-black text-gray-800">{value}</div><div className="mt-1 text-[10px] text-gray-400">{detail}</div></div>; }
function SmallStat({ label, value }) { return <div className="rounded-2xl bg-gray-50 p-3"><div className="text-[10px] font-bold text-gray-400">{label}</div><div className="mt-1 font-black text-gray-700">{value}</div></div>; }
function TinyStat({ label, value, tone = 'text-gray-700' }) { return <div className="rounded-xl bg-white p-2"><div className="text-[9px] font-bold text-gray-400">{label}</div><div className={`mt-1 text-sm font-black ${tone}`}>{value}</div></div>; }
function RangeBar({ label, value, max, className, strong = false }) { const width = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100)); return <div className="flex items-center gap-2"><span className={`w-6 text-[10px] ${strong ? 'font-bold text-indigo-600' : 'text-gray-400'}`}>{label}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${className}`} style={{ width: `${width}%` }} /></div><span className={`w-14 text-right text-xs ${strong ? 'font-bold text-indigo-600' : 'font-medium text-gray-500'}`}>{formatTime(value)}</span></div>; }
