import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateKeyFromDate, formatDateLabel, isToday, shiftDateKey } from '../utils/date.js';

export function DateNavigator({ dateKey, onChange }) {
  const today = dateKeyFromDate();

  return (
    <div className="mt-5 rounded-2xl bg-white/10 p-2 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(shiftDateKey(dateKey, -1))}
          aria-label="前の日へ"
          className="rounded-xl p-2 text-white transition hover:bg-white/15"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-bold text-white">{formatDateLabel(dateKey)}</div>
          <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-indigo-100">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isToday(dateKey) ? '今日' : '日付を選択'}</span>
            <input
              type="date"
              value={dateKey}
              max="9999-12-31"
              onChange={(event) => event.target.value && onChange(event.target.value)}
              aria-label="表示する日付を選択"
              className="w-[7.6rem] rounded-lg border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] text-white outline-none"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => onChange(shiftDateKey(dateKey, 1))}
          aria-label="次の日へ"
          className="rounded-xl p-2 text-white transition hover:bg-white/15"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {!isToday(dateKey) && (
        <button
          type="button"
          onClick={() => onChange(today)}
          className="mt-1 w-full rounded-lg py-1 text-[11px] font-bold text-indigo-100 transition hover:bg-white/10"
        >
          今日に戻る
        </button>
      )}
    </div>
  );
}
