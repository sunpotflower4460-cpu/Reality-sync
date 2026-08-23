import { Plus } from 'lucide-react';

export default function PlanView({ schedules, onAdd }) {
  return (
    <div className="space-y-6 pt-4 animate-in">
      <div className="mb-2 flex items-end justify-between">
        <h2 className="text-lg font-extrabold text-gray-800">理想のスケジュール</h2>
        <span className="text-xs text-gray-500">計画モード</span>
      </div>

      <div className="space-y-3">
        {schedules.map((schedule) => (
          <article key={schedule.id} className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="w-12 shrink-0 text-center font-bold text-indigo-600">{schedule.time}</div>
            <div className="flex-1">
              <div className="mb-1 text-sm font-bold text-gray-800">{schedule.title}</div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">{schedule.category}</span>
                <span className="text-[10px] text-gray-400">{schedule.duration}分</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="mb-1 text-[10px] font-bold text-gray-400">想定負荷</span>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border-4 text-xs font-bold"
                style={{ borderColor: schedule.plannedStress > 70 ? '#fca5a5' : schedule.plannedStress > 40 ? '#fde047' : '#bbf7d0', color: schedule.plannedStress > 70 ? '#ef4444' : schedule.plannedStress > 40 ? '#eab308' : '#22c55e' }}
              >
                {schedule.plannedStress}
              </div>
            </div>
          </article>
        ))}
      </div>

      <button type="button" onClick={onAdd} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 py-4 font-bold text-indigo-500 transition-colors hover:bg-indigo-50">
        <Plus className="h-5 w-5" /> 予定を追加する
      </button>
    </div>
  );
}
