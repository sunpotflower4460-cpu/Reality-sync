import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateKeyFromDate, formatDateLabel, isToday, shiftDateKey } from '../utils/date.js';

export function DateNavigator({ dateKey, onChange }) {
  const today = dateKeyFromDate();
  const todaySelected = isToday(dateKey);

  return (
    <div className="mt-2.5">
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1 rounded-[1.05rem] border border-white/14 bg-white/9 p-1 shadow-inner backdrop-blur-sm">
        <button
          type="button"
          onClick={() => onChange(shiftDateKey(dateKey, -1))}
          aria-label="前の日へ"
          className="flex h-10 w-10 items-center justify-center rounded-[0.85rem] text-white/90 transition hover:bg-white/12 active:bg-white/18"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <label className="relative flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-[0.85rem] px-2 text-center transition hover:bg-white/8 active:bg-white/12">
          <CalendarDays className="h-4 w-4 shrink-0 text-indigo-100" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-black tracking-tight text-white">{formatDateLabel(dateKey)}</span>
            <span className="mt-0.5 block text-[8px] font-bold tracking-wide text-indigo-100/85">{todaySelected ? '今日' : '日付を選ぶ'}</span>
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
          className="flex h-10 w-10 items-center justify-center rounded-[0.85rem] text-white/90 transition hover:bg-white/12 active:bg-white/18"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {!todaySelected && (
        <button
          type="button"
          onClick={() => onChange(today)}
          className="mx-auto mt-1 flex min-h-7 items-center justify-center rounded-full px-4 text-[9px] font-extrabold text-indigo-100 transition hover:bg-white/10 active:bg-white/15"
        >
          今日に戻る
        </button>
      )}
    </div>
  );
}
