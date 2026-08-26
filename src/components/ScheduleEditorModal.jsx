import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { CATEGORIES, STATUS } from '../constants.js';
import { isValidTime } from '../utils/schedule.js';
import { ModalDialog } from './ModalDialog.jsx';

export function ScheduleEditorModal({ schedule, onClose, onSave, onDelete }) {
  const editing = Boolean(schedule);
  const hasRecord = schedule && schedule.status !== STATUS.PENDING;
  const [time, setTime] = useState(schedule?.time ?? '09:00');
  const [title, setTitle] = useState(schedule?.title ?? '');
  const [category, setCategory] = useState(schedule?.category ?? '仕事');
  const [duration, setDuration] = useState(String(schedule?.duration ?? 60));
  const [plannedStress, setPlannedStress] = useState(String(schedule?.plannedStress ?? 30));
  const [error, setError] = useState('');

  const submit = () => {
    const cleanTitle = title.trim();
    const parsedDuration = Number(duration);
    const parsedStress = Number(plannedStress);

    if (!cleanTitle) { setError('予定の名前を入力してください。'); return; }
    if (!isValidTime(time)) { setError('開始時刻を正しく入力してください。'); return; }
    if (!CATEGORIES.includes(category)) { setError('カテゴリを選択してください。'); return; }
    if (!Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 1440) { setError('予定時間は1〜1440分の範囲で入力してください。'); return; }
    if (!Number.isInteger(parsedStress) || parsedStress < 0 || parsedStress > 100) { setError('想定負荷は0〜100の範囲で入力してください。'); return; }

    onSave({ time, title: cleanTitle, category, duration: parsedDuration, plannedStress: parsedStress });
  };

  const requestDelete = () => {
    if (!schedule || !onDelete) return;
    const message = hasRecord
      ? 'この予定には実績記録があります。予定と実績の両方を削除しますか？'
      : 'この予定を削除しますか？';
    if (window.confirm(message)) onDelete(schedule.id);
  };

  return (
    <ModalDialog
      onClose={onClose}
      labelledBy="schedule-editor-title"
      placement="sheet"
      className="sheet-scroll max-h-[94dvh] w-full max-w-sm overflow-y-auto rounded-t-[1.65rem] rounded-b-none bg-[#f7f8fb] shadow-[0_22px_64px_rgba(15,23,42,0.24)] sm:rounded-[1.65rem]"
    >
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/96 px-4 pb-3 pt-2 backdrop-blur-2xl sm:pt-4">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[8px] font-semibold tracking-[0.16em] text-indigo-500">PLAN</p>
            <h3 id="schedule-editor-title" className="mt-0.5 text-[16px] font-semibold tracking-[-0.02em] text-slate-900">{editing ? '予定を編集' : '予定を追加'}</h3>
            <p className="mt-0.5 text-[9px] text-slate-400">理想の1日を、無理なく置いていく</p>
          </div>
          <button type="button" onClick={onClose} aria-label="予定編集を閉じる" className="tap-target flex items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"><X className="h-4.5 w-4.5" /></button>
        </div>
      </div>

      <div className="space-y-3 p-3.5">
        {hasRecord && <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-[9px] leading-relaxed text-indigo-700">この予定には実績があります。予定を編集しても、すでに記録した実際の行動・カテゴリ・時間は保持されます。</div>}

        <section className="app-group divide-y divide-slate-100">
          <label className="block p-3.5">
            <span className="mb-1.5 block text-[10px] font-semibold text-slate-700">予定の名前</span>
            <input type="text" value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }} placeholder="例: 朝の散歩" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white" />
          </label>

          <div className="grid grid-cols-2 gap-3 p-3.5">
            <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-slate-700">開始時刻</span><input type="time" value={time} onChange={(event) => { setTime(event.target.value); setError(''); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800 outline-none focus:border-indigo-400 focus:bg-white" /></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-slate-700">予定時間</span><div className="relative"><input type="number" inputMode="numeric" min="1" max="1440" step="5" value={duration} onChange={(event) => { setDuration(event.target.value); setError(''); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 pr-8 text-slate-800 outline-none focus:border-indigo-400 focus:bg-white" /><span className="pointer-events-none absolute right-2.5 top-3.5 text-[9px] text-slate-400">分</span></div></label>
          </div>

          <label className="block p-3.5"><span className="mb-1.5 block text-[10px] font-semibold text-slate-700">カテゴリ</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700 outline-none focus:border-indigo-400 focus:bg-white">{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>

          <label className="block p-3.5">
            <span className="mb-2 flex items-end justify-between"><span><span className="block text-[12px] font-semibold text-slate-800">想定負荷</span><span className="mt-0.5 block text-[8px] font-normal text-slate-400">その予定を始める前の感覚でOK</span></span><span className="text-[18px] font-semibold text-indigo-600">{plannedStress || '—'}</span></span>
            <input type="range" min="0" max="100" value={plannedStress || 0} onChange={(event) => { setPlannedStress(event.target.value); setError(''); }} className="reality-range w-full" />
            <div className="flex justify-between text-[8px] font-medium text-slate-400"><span>楽そう</span><span>かなり重そう</span></div>
          </label>
        </section>

        {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-[10px] font-medium text-rose-600">{error}</p>}
      </div>

      <div className="sticky bottom-0 z-10 space-y-1 border-t border-slate-100 bg-white/96 p-3 pb-modal-safe backdrop-blur-2xl">
        <button type="button" onClick={submit} className="min-h-12 w-full rounded-xl bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-[0_5px_16px_rgba(79,70,229,0.16)] transition hover:bg-indigo-700 active:scale-[0.99]">{editing ? '変更を保存' : '予定を追加'}</button>
        {editing && onDelete && <button type="button" onClick={requestDelete} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-[9px] font-medium text-rose-500 transition hover:bg-rose-50"><Trash2 className="h-4 w-4" />予定を削除</button>}
      </div>
    </ModalDialog>
  );
}
