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

    if (!cleanTitle) {
      setError('予定の名前を入力してください。');
      return;
    }
    if (!isValidTime(time)) {
      setError('開始時刻を正しく入力してください。');
      return;
    }
    if (!CATEGORIES.includes(category)) {
      setError('カテゴリを選択してください。');
      return;
    }
    if (!Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 1440) {
      setError('予定時間は1〜1440分の範囲で入力してください。');
      return;
    }
    if (!Number.isInteger(parsedStress) || parsedStress < 0 || parsedStress > 100) {
      setError('想定負荷は0〜100の範囲で入力してください。');
      return;
    }

    onSave({
      time,
      title: cleanTitle,
      category,
      duration: parsedDuration,
      plannedStress: parsedStress,
    });
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
      className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-2xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-4">
        <div>
          <h3 id="schedule-editor-title" className="font-bold text-gray-900">{editing ? '予定を編集' : '予定を追加'}</h3>
          <p className="text-[11px] text-gray-400">理想の1日を、無理なく置いていく</p>
        </div>
        <button type="button" onClick={onClose} aria-label="予定編集を閉じる" className="rounded-full bg-gray-100 p-1.5 text-gray-400 hover:text-gray-600"><XCircle className="h-5 w-5" /></button>
      </div>

      <div className="space-y-5 p-5">
        {hasRecord && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-700">
            この予定には実績があります。予定を編集しても、すでに記録した実際の行動・カテゴリ・時間は保持されます。
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-gray-700">予定の名前</span>
          <input type="text" value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }} placeholder="例: 朝の散歩" className="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700">開始時刻</span>
            <input type="time" value={time} onChange={(event) => { setTime(event.target.value); setError(''); }} className="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-indigo-400" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700">予定時間</span>
            <div className="relative"><input type="number" inputMode="numeric" min="1" max="1440" step="5" value={duration} onChange={(event) => { setDuration(event.target.value); setError(''); }} className="w-full rounded-xl border border-gray-200 bg-white p-3 pr-9 outline-none focus:border-indigo-400" /><span className="pointer-events-none absolute right-3 top-3 text-sm text-gray-400">分</span></div>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-gray-700">カテゴリ</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white p-3 text-gray-700 outline-none focus:border-indigo-400">
            {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label className="block rounded-xl border border-gray-100 bg-gray-50 p-4">
          <span className="mb-2 flex items-end justify-between"><span className="text-sm font-bold text-gray-700">想定負荷</span><span className="text-xl font-black text-indigo-600">{plannedStress || '—'}</span></span>
          <input type="range" min="0" max="100" value={plannedStress || 0} onChange={(event) => { setPlannedStress(event.target.value); setError(''); }} className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-indigo-600" />
          <div className="mt-1 flex justify-between text-[10px] font-bold text-gray-400"><span>0 楽</span><span>100 重い</span></div>
        </label>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}
      </div>

      <div className="sticky bottom-0 z-10 space-y-2 border-t border-gray-100 bg-white p-4">
        <button type="button" onClick={submit} className="w-full rounded-xl bg-indigo-600 py-3.5 font-bold text-white shadow-md transition hover:bg-indigo-700 active:scale-[0.99]">{editing ? '変更を保存' : '予定を追加'}</button>
        {editing && onDelete && <button type="button" onClick={requestDelete} className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-50"><Trash2 className="h-4 w-4" />予定を削除</button>}
      </div>
    </ModalDialog>
  );
}
