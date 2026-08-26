import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateKeyFromDate, formatDateLabel, isToday, shiftDateKey } from '../utils/date.js';

export function DateNavigator({ dateKey, onChange }) {
  const today = dateKeyFromDate();
  const todaySelected = isToday(dateKey);

  return (
    <div className="mt-1.5">
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-0.5 rounded-[0.95rem] border border-slate-200/75 bg-slate-100/72 p-0.5">
        <button
          type="button"
          onClick={() => onChange(shiftDateKey(dateKey, -1))}
          aria-label="前の日へ"
          className="tap-target flex items-center justify-center rounded-[0.8rem] text-slate-500 transition hover:bg-white/80 hover:text-slate-700 active:bg-white"
        >
          <ChevronLeft className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
        </button>

        <label className="relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[0.8rem] px-2 text-center transition hover:bg-white/65 active:bg-white">
          <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-semibold tracking-tight text-slate-800">{formatDateLabel(dateKey)}</span>
            <span className="mt-0.5 block text-[8px] font-medium tracking-wide text-slate-400">{todaySelected ? '今日' : '日付を選ぶ'}</span>
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
          className="tap-target flex items-center justify-center rounded-[0.8rem] text-slate-500 transition hover:bg-white/80 hover:text-slate-700 active:bg-white"
        >
          <ChevronRight className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
        </button>
      </div>

      {!todaySelected && (
        <button
          type="button"
          onClick={() => onChange(today)}
          className="mx-auto mt-0.5 flex min-h-7 items-center justify-center rounded-full px-4 text-[9px] font-semibold text-indigo-600 transition hover:bg-indigo-50 active:bg-indigo-100"
        >
          今日に戻る
        </button>
      )}
    </div>
  );
}
