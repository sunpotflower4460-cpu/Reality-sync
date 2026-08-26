import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Clock, Frown, Meh, Smile, XCircle } from 'lucide-react';
import { CATEGORIES, MOOD, STATUS } from '../constants.js';
import { isValidDateKey } from '../utils/date.js';
import {
  clampNumber,
  createPlannedSnapshot,
  durationAfterStatusChange,
  isValidTime,
  parseActualDuration,
  recordedPlanForSchedule,
  replacementTitleForEditing,
} from '../utils/schedule.js';
import { ModalDialog } from './ModalDialog.jsx';

export function RecordModal({ schedule, dateKey, onClose, onSave }) {
  const recordedPlan = recordedPlanForSchedule(schedule);
  const planReferenceLabel = schedule.plannedSnapshot
    ? '記録時の予定'
    : schedule.status === STATUS.PENDING
      ? '予定'
      : '現在の予定（記録時は不明）';
  const [recordMode, setRecordMode] = useState(schedule.status !== STATUS.PENDING ? schedule.status : STATUS.AS_PLANNED);
  const [actualTitle, setActualTitle] = useState(() => replacementTitleForEditing(schedule));
  const [actualCategory, setActualCategory] = useState(schedule.actualCategory || recordedPlan.category || 'その他');
  const [mood, setMood] = useState(schedule.mood || MOOD.NORMAL);
  const [actualStress, setActualStress] = useState(schedule.actualStress ?? recordedPlan.plannedStress);
  const [actualDuration, setActualDuration] = useState(schedule.actualDuration ?? (schedule.status === STATUS.SKIPPED ? 0 : recordedPlan.duration));
  const [actualStartTime, setActualStartTime] = useState(schedule.actualStartTime || '');
  const [actualStartDateKey, setActualStartDateKey] = useState(schedule.actualStartDateKey || dateKey || '');
  const [deviationReason, setDeviationReason] = useState(schedule.deviationReason || '');
  const [error, setError] = useState('');

  const title = useMemo(() => {
    if (recordMode === STATUS.AS_PLANNED) {
      return schedule.status === STATUS.AS_PLANNED && schedule.actualTitle
        ? schedule.actualTitle
        : recordedPlan.title;
    }
    if (recordMode === STATUS.SKIPPED) return 'スキップ';
    return actualTitle.trim();
  }, [actualTitle, recordMode, recordedPlan.title, schedule.actualTitle, schedule.status]);

  const selectMode = (nextMode) => {
    setActualDuration((current) => durationAfterStatusChange(current, recordMode, nextMode, recordedPlan.duration));
    setRecordMode(nextMode);
    setError('');
  };

  const submit = () => {
    if (recordMode === STATUS.CHANGED && !actualTitle.trim()) {
      setError('予定を変更した場合は、代わりに行ったことを入力してください。');
      return;
    }

    const parsedDuration = recordMode === STATUS.SKIPPED ? 0 : parseActualDuration(actualDuration);
    if (recordMode !== STATUS.SKIPPED && parsedDuration === null) {
      setError('実際に費やした時間を0〜1440分の範囲で入力してください。');
      return;
    }

    if (recordMode !== STATUS.SKIPPED && actualStartTime && !isValidTime(actualStartTime)) {
      setError('実際の開始時刻を正しい時刻で入力してください。');
      return;
    }

    if (recordMode !== STATUS.SKIPPED && actualStartTime && !isValidDateKey(actualStartDateKey)) {
      setError('実際の開始日を正しい日付で入力してください。');
      return;
    }

    const recordedCategory = recordMode === STATUS.SKIPPED
      ? null
      : recordMode === STATUS.CHANGED
        ? actualCategory
        : schedule.status === STATUS.AS_PLANNED
          ? schedule.actualCategory || recordedPlan.category
          : recordedPlan.category;
    const plannedSnapshot = schedule.plannedSnapshot
      ?? (schedule.status === STATUS.PENDING ? createPlannedSnapshot(schedule) : null);

    onSave({
      status: recordMode,
      plannedSnapshot,
      actualTitle: title,
      actualCategory: recordedCategory,
      mood,
      actualStress: clampNumber(actualStress, 0, 100),
      actualDuration: parsedDuration,
      actualStartTime: recordMode === STATUS.SKIPPED ? null : (actualStartTime || null),
      actualStartDateKey: recordMode === STATUS.SKIPPED || !actualStartTime ? null : actualStartDateKey,
      deviationReason: recordMode === STATUS.CHANGED || recordMode === STATUS.SKIPPED
        ? deviationReason.trim() || null
        : null,
    });
  };

  const detailSummary = recordMode === STATUS.AS_PLANNED
    ? '開始日時を詳しく残す'
    : recordMode === STATUS.SKIPPED
      ? '休んだ理由を残す（任意）'
      : '開始日時・変更理由を詳しく残す';

  return (
    <ModalDialog
      onClose={onClose}
      labelledBy="record-modal-title"
      placement="sheet"
      className="max-h-[94dvh] w-full max-w-sm overflow-y-auto rounded-t-[1.75rem] rounded-b-none bg-[#f7f8fb] shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:rounded-[1.75rem]"
    >
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/96 px-4 pb-3 pt-2 backdrop-blur-xl sm:pt-4">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[8px] font-black tracking-[0.18em] text-indigo-500">RECORD</p>
            <h3 id="record-modal-title" className="mt-0.5 text-base font-black text-slate-900">実際どうだった？</h3>
            <p className="mt-0.5 text-[9px] font-medium text-slate-400">評価ではなく、今日の現実を残す</p>
          </div>
          <button type="button" onClick={onClose} aria-label="記録画面を閉じる" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"><XCircle className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="app-card flex items-center gap-3 rounded-[1.2rem] p-3 text-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500"><Clock className="h-4 w-4" aria-hidden="true" /></div>
          <div className="min-w-0"><div className="text-[8px] font-semibold text-slate-400">{planReferenceLabel} ・ {dateKey} {recordedPlan.time}</div><div className="mt-0.5 truncate text-[13px] font-black text-slate-800">{recordedPlan.title}</div></div>
        </div>

        <fieldset className="app-card rounded-[1.2rem] p-3">
          <legend className="px-1 text-[13px] font-black text-slate-800">どうなりましたか？</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <ModeButton active={recordMode === STATUS.AS_PLANNED} onClick={() => selectMode(STATUS.AS_PLANNED)} Icon={CheckCircle2} activeClass="border-emerald-300 bg-emerald-50 text-emerald-700" label="予定通り" />
            <ModeButton active={recordMode === STATUS.CHANGED} onClick={() => selectMode(STATUS.CHANGED)} Icon={AlertCircle} activeClass="border-amber-300 bg-amber-50 text-amber-700" label="変更" />
            <ModeButton active={recordMode === STATUS.SKIPPED} onClick={() => selectMode(STATUS.SKIPPED)} Icon={XCircle} activeClass="border-rose-200 bg-rose-50 text-rose-600" label="休んだ" />
          </div>
        </fieldset>

        {recordMode === STATUS.CHANGED && (
          <div className="animate-slide-down space-y-3 rounded-[1.2rem] border border-amber-100 bg-amber-50/70 p-3">
            <label className="block"><span className="mb-1.5 block text-[11px] font-extrabold text-amber-800">代わりに行ったこと</span><input type="text" value={actualTitle} onChange={(event) => { setActualTitle(event.target.value); setError(''); }} placeholder="例: ベッドで本を読んだ" className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm outline-none focus:border-amber-400" /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-extrabold text-amber-800">カテゴリ</span><select value={actualCategory} onChange={(event) => setActualCategory(event.target.value)} className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-amber-400">{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          </div>
        )}

        {recordMode !== STATUS.SKIPPED && (
          <label className="app-card block rounded-[1.2rem] p-3">
            <span className="flex items-center justify-between gap-2"><span className="text-[13px] font-black text-slate-800">実際にかかった時間</span><span className="text-[13px] font-black text-indigo-600">{actualDuration === '' ? '—' : `${actualDuration}分`}</span></span>
            <div className="relative mt-2"><input type="number" inputMode="numeric" min="0" max="1440" step="5" value={actualDuration} onChange={(event) => { setActualDuration(event.target.value); setError(''); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 pr-10 text-base font-black text-slate-800 outline-none focus:border-indigo-400 focus:bg-white" /><span className="pointer-events-none absolute right-3 top-3.5 text-xs font-bold text-slate-400">分</span></div>
            <span className="mt-1 block text-[9px] font-medium text-slate-400">予定は {recordedPlan.duration}分</span>
          </label>
        )}

        <div className="app-card space-y-2.5 rounded-[1.2rem] p-3">
          <div className="flex items-end justify-between"><div><p className="text-[13px] font-black text-slate-800">実際の負荷</p><p className="mt-0.5 text-[9px] font-medium text-slate-400">予定では {recordedPlan.plannedStress}</p></div><span className={`text-xl font-black ${actualStress > 80 ? 'text-rose-500' : 'text-indigo-600'}`}>{actualStress}</span></div>
          <input type="range" min="0" max="100" value={actualStress} onChange={(event) => setActualStress(Number(event.target.value))} className="reality-range w-full" />
          <div className="flex justify-between text-[8px] font-bold text-slate-400"><span>楽だった</span><span>かなり重かった</span></div>
        </div>

        <fieldset className="app-card rounded-[1.2rem] p-3">
          <legend className="px-1 text-[13px] font-black text-slate-800">終わった時の気分</legend>
          <div className="mt-2 flex gap-2"><MoodButton active={mood === MOOD.GOOD} onClick={() => setMood(MOOD.GOOD)} Icon={Smile} label="良い" /><MoodButton active={mood === MOOD.NORMAL} onClick={() => setMood(MOOD.NORMAL)} Icon={Meh} label="普通" /><MoodButton active={mood === MOOD.BAD} onClick={() => setMood(MOOD.BAD)} Icon={Frown} label="疲れた" /></div>
        </fieldset>

        <details className="app-card group rounded-[1.2rem]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[10px] font-extrabold text-slate-500">
            <span>{detailSummary}</span><ChevronDown className="h-4 w-4 shrink-0 text-slate-300 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-4 border-t border-slate-100 p-3.5">
            {recordMode !== STATUS.SKIPPED && (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-slate-600">開始日</span><input type="date" value={actualStartDateKey} onChange={(event) => { setActualStartDateKey(event.target.value); setError(''); }} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" /></label>
                  <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-slate-600">開始時刻</span><input type="time" value={actualStartTime} onChange={(event) => { setActualStartTime(event.target.value); setError(''); }} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" /></label>
                </div>
                <p className="mt-1.5 text-[9px] leading-relaxed text-slate-400">覚えていなければ空欄でOKです。時刻を入れた時だけ開始日とセットで保存します。</p>
              </div>
            )}

            {(recordMode === STATUS.CHANGED || recordMode === STATUS.SKIPPED) && (
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold text-slate-600">{recordMode === STATUS.SKIPPED ? '休んだ理由' : '変更した理由'} <span className="font-normal text-slate-400">（任意）</span></span>
                <textarea value={deviationReason} onChange={(event) => setDeviationReason(event.target.value)} rows={3} placeholder="例: 眠気が強かった / 急な連絡が入った" className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-indigo-400" />
                <span className="mt-1 block text-[9px] leading-relaxed text-slate-400">理由は評価せず、あとで振り返るための記録として使います。</span>
              </label>
            )}
          </div>
        </details>

        {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-[11px] font-semibold text-rose-600">{error}</p>}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-slate-100 bg-white/96 p-3 pb-modal-safe backdrop-blur-xl"><button type="button" onClick={submit} className="min-h-12 w-full rounded-xl bg-indigo-600 px-4 text-sm font-extrabold text-white transition hover:bg-indigo-700 active:scale-[0.99]">この内容で記録する</button></div>
    </ModalDialog>
  );
}

function ModeButton({ active, onClick, Icon, activeClass, label }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition ${active ? `${activeClass} shadow-sm` : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}><Icon className={`h-[1.1rem] w-[1.1rem] ${active ? '' : 'text-slate-400'}`} aria-hidden="true" /><span className="text-[10px] font-extrabold">{label}</span></button>;
}

function MoodButton({ active, onClick, Icon, label }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 text-[10px] font-extrabold transition ${active ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}><Icon className={`h-4 w-4 ${active ? 'text-indigo-500' : 'text-slate-400'}`} aria-hidden="true" />{label}</button>;
}
