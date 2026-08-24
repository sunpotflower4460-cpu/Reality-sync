import { useState } from 'react';
import { Trash2, XCircle } from 'lucide-react';
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
    <ModalDialog onClose={onClose} labelledBy="schedule-editor-title" className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-[1.8rem] bg-[#f7f8fb] shadow-[0_24px_70px_rgba(15,23,42,0.24)]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 p-4 backdrop-blur-xl">
        <div>
          <p className="text-[9px] font-black tracking-[0.16em] text-indigo-500">PLAN</p>
          <h3 id="schedule-editor-title" className="mt-0.5 text-base font-black text-slate-900">{editing ? '予定を編集' : '予定を追加'}</h3>
          <p className="mt-0.5 text-[10px] text-slate-400">理想の1日を、無理なく置いていく</p>
        </div>
        <button type="button" onClick={onClose} aria-label="予定編集を閉じる" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>
      </div>

      <div className="space-y-4 p-4">
        {hasRecord && <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3.5 text-[11px] leading-relaxed text-indigo-700">この予定には実績があります。予定を編集しても、すでに記録した実際の行動・カテゴリ・時間は保持されます。</div>}

        <section className="app-card space-y-4 rounded-2xl p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold text-slate-700">予定の名前</span>
            <input type="text" value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }} placeholder="例: 朝の散歩" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1.5 block text-xs font-extrabold text-slate-700">開始時刻</span><input type="time" value={time} onChange={(event) => { setTime(event.target.value); setError(''); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-extrabold text-slate-700">予定時間</span><div className="relative"><input type="number" inputMode="numeric" min="1" max="1440" step="5" value={duration} onChange={(event) => { setDuration(event.target.value); setError(''); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 pr-9 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white" /><span className="pointer-events-none absolute right-3 top-3 text-sm text-slate-400">分</span></div></label>
          </div>

          <label className="block"><span className="mb-1.5 block text-xs font-extrabold text-slate-700">カテゴリ</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white">{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </section>

        <label className="app-card block rounded-2xl p-4">
          <span className="mb-2 flex items-end justify-between"><span><span className="block text-sm font-black text-slate-800">想定負荷</span><span className="mt-0.5 block text-[9px] font-medium text-slate-400">その予定を始める前の感覚でOK</span></span><span className="text-2xl font-black text-indigo-600">{plannedStress || '—'}</span></span>
          <input type="range" min="0" max="100" value={plannedStress || 0} onChange={(event) => { setPlannedStress(event.target.value); setError(''); }} className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-indigo-600" />
          <div className="mt-1.5 flex justify-between text-[9px] font-bold text-slate-400"><span>楽そう</span><span>かなり重そう</span></div>
        </label>

        {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-600">{error}</p>}
      </div>

      <div className="sticky bottom-0 z-10 space-y-1.5 border-t border-slate-100 bg-white/96 p-4 pb-modal-safe backdrop-blur-xl">
        <button type="button" onClick={submit} className="min-h-12 w-full rounded-2xl bg-indigo-600 px-4 font-extrabold text-white shadow-[0_8px_22px_rgba(79,70,229,0.24)] transition hover:bg-indigo-700 active:scale-[0.99]">{editing ? '変更を保存' : '予定を追加'}</button>
        {editing && onDelete && <button type="button" onClick={requestDelete} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-extrabold text-rose-500 transition hover:bg-rose-50"><Trash2 className="h-4 w-4" />予定を削除</button>}
      </div>
    </ModalDialog>
  );
}
