import { Plus } from 'lucide-react';
import { sortSchedulesByTime } from '../utils/schedule.js';

function stressTone(value) {
  if (value > 70) return { borderColor: '#fca5a5', color: '#ef4444' };
  if (value > 40) return { borderColor: '#fde047', color: '#ca8a04' };
  return { borderColor: '#bbf7d0', color: '#16a34a' };
}

export function PlanView({ schedules, onOpenPlanModal }) {
  const orderedSchedules = sortSchedulesByTime(schedules);

  return (
    <div className="animate-fade-in space-y-6 pt-4">
      <div className="mb-2 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-gray-800">理想のスケジュール</h2>
          <p className="mt-1 text-xs text-gray-500">まずは「こう過ごしたい」を置いてみる</p>
        </div>
        <span className="text-xs text-gray-500">計画モード</span>
      </div>

      <div className="space-y-3">
        {orderedSchedules.map((schedule) => (
          <article key={schedule.id} className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <time className="w-12 shrink-0 text-center font-bold text-indigo-600" dateTime={schedule.time}>{schedule.time}</time>
            <div className="min-w-0 flex-1">
              <div className="mb-1 truncate text-sm font-bold text-gray-800">{schedule.title}</div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">{schedule.category}</span>
                <span className="text-[10px] text-gray-400">{schedule.duration}分</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="mb-1 text-[10px] font-bold text-gray-400">想定負荷</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-4 text-xs font-bold" style={stressTone(schedule.plannedStress)} aria-label={`想定負荷 ${schedule.plannedStress}`}>{schedule.plannedStress}</div>
            </div>
          </article>
        ))}
      </div>

      <button type="button" onClick={onOpenPlanModal} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 py-4 font-bold text-indigo-500 transition-colors hover:bg-indigo-50">
        <Plus className="h-5 w-5" aria-hidden="true" />予定を追加する
      </button>
    </div>
  );
}
