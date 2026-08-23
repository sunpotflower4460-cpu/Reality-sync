import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Frown, Meh, Smile, XCircle } from 'lucide-react';
import { CATEGORIES, MOOD, STATUS } from '../constants.js';
import { clampNumber } from '../utils/schedule.js';

export function RecordModal({ schedule, onClose, onSave }) {
  const [recordMode, setRecordMode] = useState(schedule.status !== STATUS.PENDING ? schedule.status : STATUS.AS_PLANNED);
  const [actualTitle, setActualTitle] = useState(schedule.actualTitle || '');
  const [actualCategory, setActualCategory] = useState(schedule.actualCategory || schedule.category || 'その他');
  const [mood, setMood] = useState(schedule.mood || MOOD.NORMAL);
  const [actualStress, setActualStress] = useState(schedule.actualStress ?? schedule.plannedStress);
  const [actualDuration, setActualDuration] = useState(schedule.actualDuration ?? (schedule.status === STATUS.SKIPPED ? 0 : schedule.duration));
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (recordMode === STATUS.SKIPPED && schedule.status === STATUS.PENDING) setActualDuration(0);
  }, [recordMode, schedule.status]);

  const title = useMemo(() => {
    if (recordMode === STATUS.AS_PLANNED) return schedule.title;
    if (recordMode === STATUS.SKIPPED) return 'スキップ';
    return actualTitle.trim();
  }, [actualTitle, recordMode, schedule.title]);

  const submit = () => {
    if (recordMode === STATUS.CHANGED && !actualTitle.trim()) {
      setError('予定を変更した場合は、代わりに行ったことを入力してください。');
      return;
    }
    onSave({
      status: recordMode,
      actualTitle: title,
      actualCategory: recordMode === STATUS.CHANGED ? actualCategory : null,
      mood,
      actualStress: clampNumber(actualStress, 0, 100),
      actualDuration: recordMode === STATUS.SKIPPED ? 0 : clampNumber(actualDuration, 0, 1440),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="record-modal-title" className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-indigo-50 p-4">
          <h3 id="record-modal-title" className="font-bold text-indigo-900">実績を記録する</h3>
          <button type="button" onClick={onClose} aria-label="記録画面を閉じる" className="rounded-full bg-white p-1 text-gray-400 shadow-sm hover:text-gray-600"><XCircle className="h-5 w-5" /></button>
        </div>

        <div className="space-y-6 p-5">
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm"><Clock className="h-5 w-5 text-indigo-400" aria-hidden="true" /><div><div className="font-medium text-gray-500">{schedule.time}</div><div className="font-bold text-gray-800">{schedule.title}</div></div></div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-gray-700">実際にはどうでしたか？</legend>
            <div className="grid gap-2">
              <ModeButton active={recordMode === STATUS.AS_PLANNED} onClick={() => { setRecordMode(STATUS.AS_PLANNED); setError(''); }} Icon={CheckCircle2} activeClass="border-green-500 bg-green-50 text-green-700" label="予定通り実行した" />
              <ModeButton active={recordMode === STATUS.CHANGED} onClick={() => { setRecordMode(STATUS.CHANGED); setError(''); }} Icon={AlertCircle} activeClass="border-orange-500 bg-orange-50 text-orange-700" label="予定を変更して行動した" />
              <ModeButton active={recordMode === STATUS.SKIPPED} onClick={() => { setRecordMode(STATUS.SKIPPED); setError(''); }} Icon={XCircle} activeClass="border-red-500 bg-red-50 text-red-700" label="スキップした（休んだ）" />
            </div>
          </fieldset>

          {recordMode === STATUS.CHANGED && (
            <div className="animate-slide-down space-y-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
              <label className="block"><span className="mb-1 block text-sm font-bold text-orange-800">代わりに行ったこと</span><input type="text" value={actualTitle} onChange={(event) => { setActualTitle(event.target.value); setError(''); }} placeholder="例: ベッドで本を読んだ" className="w-full rounded-xl border border-orange-200 bg-white p-3 outline-none" /></label>
              <label className="block"><span className="mb-1 block text-sm font-bold text-orange-800">そのカテゴリ</span><select value={actualCategory} onChange={(event) => setActualCategory(event.target.value)} className="w-full rounded-xl border border-orange-200 bg-white p-3 text-gray-700 outline-none">{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            </div>
          )}

          {recordMode !== STATUS.SKIPPED && (
            <label className="block space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4"><span className="flex items-end justify-between"><span className="text-sm font-bold text-gray-700">実際に費やした時間</span><span className="text-lg font-black text-indigo-600">{actualDuration}分</span></span><input type="number" min="0" max="1440" step="5" value={actualDuration} onChange={(event) => setActualDuration(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white p-3" /><span className="block text-[10px] text-gray-500">予定は {schedule.duration}分。変更した場合も、実際の時間を記録します。</span></label>
          )}

          <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="flex items-end justify-between"><p className="text-sm font-bold text-gray-700">実際のストレス・負荷</p><span className={`text-lg font-black ${actualStress > 80 ? 'text-red-500' : 'text-indigo-600'}`}>{actualStress}</span></div>
            <p className="text-[10px] text-gray-500">計画時の想定負荷は <b>{schedule.plannedStress}</b> でした。</p>
            <input type="range" min="0" max="100" value={actualStress} onChange={(event) => setActualStress(Number(event.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-indigo-600" />
            <div className="flex justify-between text-[10px] font-bold text-gray-400"><span>0（楽勝）</span><span>100（限界）</span></div>
          </div>

          <fieldset className="space-y-3"><legend className="text-sm font-bold text-gray-700">終了時の気分は？</legend><div className="flex gap-2"><MoodButton active={mood === MOOD.GOOD} onClick={() => setMood(MOOD.GOOD)} Icon={Smile} label="良い" /><MoodButton active={mood === MOOD.NORMAL} onClick={() => setMood(MOOD.NORMAL)} Icon={Meh} label="普通" /><MoodButton active={mood === MOOD.BAD} onClick={() => setMood(MOOD.BAD)} Icon={Frown} label="疲れた" /></div></fieldset>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}
        </div>
        <div className="sticky bottom-0 z-10 border-t border-gray-100 bg-white p-4"><button type="button" onClick={submit} className="w-full rounded-xl bg-indigo-600 py-3.5 font-bold text-white shadow-md transition hover:bg-indigo-700 active:scale-[0.99]">記録を保存する</button></div>
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, Icon, activeClass, label }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${active ? activeClass : 'border-gray-200 hover:bg-gray-50'}`}><Icon className={`h-5 w-5 ${active ? '' : 'text-gray-400'}`} aria-hidden="true" /><span className="font-medium">{label}</span></button>;
}

function MoodButton({ active, onClick, Icon, label }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-3 transition ${active ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}><Icon className="h-6 w-6" aria-hidden="true" /><span className="text-xs font-bold">{label}</span></button>;
}
