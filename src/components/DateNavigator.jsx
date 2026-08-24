import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateKeyFromDate, formatDateLabel, isToday, shiftDateKey } from '../utils/date.js';

export function DateNavigator({ dateKey, onChange }) {
  const today = dateKeyFromDate();
  const todaySelected = isToday(dateKey);

  return (
    <div className="mt-4 rounded-2xl bg-white/10 p-1.5 backdrop-blur-sm">
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(shiftDateKey(dateKey, -1))}
          aria-label="前の日へ"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition hover:bg-white/15 active:bg-white/20"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <label className="relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 text-center transition hover:bg-white/10">
          <CalendarDays className="h-4 w-4 shrink-0 text-indigo-100" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold text-white">{formatDateLabel(dateKey)}</span>
            <span className="block text-[10px] font-medium text-indigo-100">{todaySelected ? '今日' : 'タップして日付を変更'}</span>
          </span>
          <input
            type="date"
            value={dateKey}
            max="9999-12-31"
            onChange={(event) => event.target.value && onChange(event.target.value)}
            aria-label="表示する日付を選択"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>

        <button
          type="button"
          onClick={() => onChange(shiftDateKey(dateKey, 1))}
          aria-label="次の日へ"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition hover:bg-white/15 active:bg-white/20"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {!todaySelected && (
        <button
          type="button"
          onClick={() => onChange(today)}
          className="mt-0.5 min-h-9 w-full rounded-lg px-3 text-[11px] font-bold text-indigo-100 transition hover:bg-white/10 active:bg-white/15"
        >
          今日に戻る
        </button>
      )}
    </div>
  );
}
