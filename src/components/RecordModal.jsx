import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Clock, Frown, Meh, Smile, X } from 'lucide-react';
import { CATEGORIES, MOOD, STATUS } from '../constants.js';
import { dateKeyFromDate, isValidDateKey } from '../utils/date.js';
import {
  createPlannedSnapshot,
  durationAfterStatusChange,
  isValidTime,
  parseActualDuration,
  recordedPlanForSchedule,
  replacementTitleForEditing,
} from '../utils/schedule.js';
import { ModalDialog } from './ModalDialog.jsx';

function isBlankValue(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

export function RecordModal({ schedule, dateKey, onClose, onSave }) {
  const recordedPlan = recordedPlanForSchedule(schedule);
  const planReferenceLabel = schedule.plannedSnapshot
    ? '記録時の予定'
    : schedule.status === STATUS.PENDING
      ? '予定'
      : '現在の予定（記録時は不明）';
  const hasRecordedStress = Number.isFinite(schedule.actualStress);
  const [recordMode, setRecordMode] = useState(schedule.status !== STATUS.PENDING ? schedule.status : STATUS.AS_PLANNED);
  const [actualTitle, setActualTitle] = useState(() => replacementTitleForEditing(schedule));
  const [actualCategory, setActualCategory] = useState(
    schedule.status === STATUS.CHANGED ? (schedule.actualCategory ?? '') : '',
  );
  const [mood, setMood] = useState(schedule.mood ?? null);
  const [actualStress, setActualStress] = useState(hasRecordedStress ? schedule.actualStress : null);
  const [stressEditing, setStressEditing] = useState(hasRecordedStress);
  const [stressDraft, setStressDraft] = useState(hasRecordedStress ? schedule.actualStress : 50);
  const [actualDuration, setActualDuration] = useState(
    schedule.status === STATUS.SKIPPED ? 0 : (schedule.actualDuration ?? ''),
  );
  const [actualStartTime, setActualStartTime] = useState(schedule.actualStartTime || '');
  const [actualStartDateKey, setActualStartDateKey] = useState(
    schedule.actualStartDateKey || (schedule.actualStartTime ? '' : (dateKey || '')),
  );
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
    setActualDuration((current) => {
      const next = durationAfterStatusChange(current, recordMode, nextMode, recordedPlan.duration);
      return next ?? '';
    });
    setRecordMode(nextMode);
    setError('');
  };

  const submit = () => {
    if (recordMode === STATUS.CHANGED && !actualTitle.trim()) {
      setError('予定を変更した場合は、代わりに行ったことを入力してください。');
      return;
    }

    const durationBlank = recordMode !== STATUS.SKIPPED && isBlankValue(actualDuration);
    const parsedDuration = recordMode === STATUS.SKIPPED ? 0 : parseActualDuration(actualDuration);
    if (recordMode !== STATUS.SKIPPED && !durationBlank && parsedDuration === null) {
      setError('実際に費やした時間は0〜1440分の範囲で入力してください。覚えていなければ空欄で保存できます。');
      return;
    }

    if (recordMode !== STATUS.SKIPPED && actualStartTime && !isValidTime(actualStartTime)) {
      setError('実際の開始時刻を正しい時刻で入力してください。');
      return;
    }

    if (recordMode !== STATUS.SKIPPED && actualStartTime && actualStartDateKey && !isValidDateKey(actualStartDateKey)) {
      setError('実際の開始日を正しい日付で入力してください。');
      return;
    }

    if (recordMode !== STATUS.SKIPPED && actualStartTime && actualStartDateKey && actualStartDateKey > dateKeyFromDate()) {
      setError('実際の開始日に未来の日付は保存できません。');
      return;
    }

    const recordedCategory = recordMode === STATUS.SKIPPED
      ? null
      : recordMode === STATUS.CHANGED
        ? (actualCategory || null)
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
      actualStress: Number.isFinite(actualStress) ? actualStress : null,
      actualDuration: recordMode === STATUS.SKIPPED ? 0 : (durationBlank ? null : parsedDuration),
      actualStartTime: recordMode === STATUS.SKIPPED ? null : (actualStartTime || null),
      actualStartDateKey: recordMode === STATUS.SKIPPED || !actualStartTime || !actualStartDateKey ? null : actualStartDateKey,
      deviationReason: recordMode === STATUS.CHANGED || recordMode === STATUS.SKIPPED
        ? deviationReason.trim() || null
        : null,
    });
  };

  const beginStressEntry = () => {
    setStressDraft(50);
    setStressEditing(true);
  };

  const updateStress = (value) => {
    const next = Number(value);
    setStressDraft(next);
    setActualStress(next);
  };

  const clearStress = () => {
    setActualStress(null);
    setStressEditing(false);
    setStressDraft(50);
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
      className="sheet-scroll max-h-[94dvh] w-full max-w-sm overflow-y-auto rounded-t-[1.65rem] rounded-b-none bg-[#f7f8fb] shadow-[0_22px_64px_rgba(15,23,42,0.24)] sm:rounded-[1.65rem]"
    >
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/96 px-4 pb-3 pt-2 backdrop-blur-2xl sm:pt-4">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[8px] font-semibold tracking-[0.16em] text-indigo-500">RECORD</p>
            <h3 id="record-modal-title" className="mt-0.5 text-[16px] font-semibold tracking-[-0.02em] text-slate-900">実際どうだった？</h3>
            <p className="mt-0.5 text-[9px] font-normal text-slate-400">評価ではなく、この日の現実を残す</p>
          </div>
          <button type="button" onClick={onClose} aria-label="記録画面を閉じる" className="tap-target flex items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"><X className="h-4.5 w-4.5" /></button>
        </div>
      </div>

      <div className="space-y-3 p-3.5">
        <div className="app-group flex items-center gap-3 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500"><Clock className="h-4 w-4" aria-hidden="true" /></div>
          <div className="min-w-0"><div className="text-[8px] font-medium text-slate-400">{planReferenceLabel} ・ {dateKey} {recordedPlan.time}</div><div className="mt-0.5 truncate text-[13px] font-semibold text-slate-800">{recordedPlan.title}</div></div>
        </div>

        <fieldset className="app-group p-2.5">
          <legend className="px-1 text-[11px] font-semibold text-slate-700">どうなりましたか？</legend>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            <ModeButton active={recordMode === STATUS.AS_PLANNED} onClick={() => selectMode(STATUS.AS_PLANNED)} Icon={CheckCircle2} activeClass="bg-white text-emerald-700 shadow-sm" label="予定通り" />
            <ModeButton active={recordMode === STATUS.CHANGED} onClick={() => selectMode(STATUS.CHANGED)} Icon={AlertCircle} activeClass="bg-white text-amber-700 shadow-sm" label="変更" />
            <ModeButton active={recordMode === STATUS.SKIPPED} onClick={() => selectMode(STATUS.SKIPPED)} Icon={X} activeClass="bg-white text-rose-600 shadow-sm" label="休んだ" />
          </div>
        </fieldset>

        {recordMode === STATUS.CHANGED && (
          <div className="animate-slide-down space-y-3 rounded-[1rem] border border-amber-100 bg-amber-50/65 p-3">
            <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-amber-800">代わりに行ったこと</span><input type="text" value={actualTitle} onChange={(event) => { setActualTitle(event.target.value); setError(''); }} placeholder="例: ベッドで本を読んだ" className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm outline-none focus:border-amber-400" /></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-amber-800">カテゴリ <span className="font-normal text-amber-600/70">（任意）</span></span><select value={actualCategory} onChange={(event) => setActualCategory(event.target.value)} className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-amber-400"><option value="">未記録</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          </div>
        )}

        <section className="app-group divide-y divide-slate-100">
          {recordMode !== STATUS.SKIPPED && (
            <label className="block p-3.5">
              <span className="flex items-center justify-between gap-4">
                <span><span className="block text-[12px] font-semibold text-slate-800">実際にかかった時間 <span className="font-normal text-slate-400">（任意）</span></span><span className="mt-0.5 block text-[8px] font-normal text-slate-400">予定は {recordedPlan.duration}分。覚えていなければ空欄でOK</span></span>
                <span className="relative flex shrink-0 items-center rounded-lg bg-slate-50 ring-1 ring-slate-200/80 focus-within:ring-indigo-300">
                  <input type="number" inputMode="numeric" min="0" max="1440" step="5" value={actualDuration ?? ''} onChange={(event) => { setActualDuration(event.target.value); setError(''); }} aria-label="実際にかかった時間（分・任意）" placeholder="—" className="w-[5.25rem] bg-transparent py-2 pl-3 pr-7 text-right text-base font-semibold text-slate-800 outline-none" />
                  <span className="pointer-events-none absolute right-2 text-[9px] font-medium text-slate-400">分</span>
                </span>
              </span>
            </label>
          )}

          <div className="space-y-2.5 p-3.5">
            <div className="flex items-end justify-between gap-3"><div><p className="text-[12px] font-semibold text-slate-800">実際の負荷 <span className="font-normal text-slate-400">（任意）</span></p><p className="mt-0.5 block text-[8px] font-normal text-slate-400">予定では {recordedPlan.plannedStress}。未記録は予定値で補いません</p></div><span className={`text-[18px] font-semibold ${actualStress === null ? 'text-slate-300' : actualStress > 80 ? 'text-rose-500' : 'text-indigo-600'}`}>{actualStress ?? '—'}</span></div>
            {!stressEditing ? (
              <button type="button" onClick={beginStressEntry} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[10px] font-medium text-indigo-600">負荷を記録する</button>
            ) : (
              <>
                <input type="range" min="0" max="100" value={stressDraft} onChange={(event) => updateStress(event.target.value)} aria-label="実際の負荷" className="reality-range w-full" />
                <div className="flex items-center justify-between text-[8px] font-medium text-slate-400"><span>楽だった</span><button type="button" onClick={clearStress} className="min-h-11 px-2 text-[8px] font-medium text-slate-400">未記録に戻す</button><span>かなり重かった</span></div>
                {actualStress === null && <p className="text-[8px] leading-relaxed text-slate-400">スライダーを動かすまで負荷は未記録のままです。</p>}
              </>
            )}
          </div>

          <fieldset className="p-3.5">
            <legend className="text-[12px] font-semibold text-slate-800">終わった時の気分 <span className="font-normal text-slate-400">（任意）</span></legend>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1"><MoodButton active={mood === MOOD.GOOD} onClick={() => setMood((current) => current === MOOD.GOOD ? null : MOOD.GOOD)} Icon={Smile} label="良い" /><MoodButton active={mood === MOOD.NORMAL} onClick={() => setMood((current) => current === MOOD.NORMAL ? null : MOOD.NORMAL)} Icon={Meh} label="普通" /><MoodButton active={mood === MOOD.BAD} onClick={() => setMood((current) => current === MOOD.BAD ? null : MOOD.BAD)} Icon={Frown} label="疲れた" /></div>
            <p className="mt-1.5 text-[8px] leading-relaxed text-slate-400">選ばなければ未記録のまま保存します。選択中の気分をもう一度押すと解除できます。</p>
          </fieldset>
        </section>

        <details className="app-group group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[10px] font-medium text-slate-500">
            <span>{detailSummary}</span><ChevronDown className="h-4 w-4 shrink-0 text-slate-300 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-4 border-t border-slate-100 p-3.5">
            {recordMode !== STATUS.SKIPPED && (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block"><span className="mb-1.5 block text-[9px] font-medium text-slate-600">開始日</span><input type="date" value={actualStartDateKey} max={dateKeyFromDate()} onChange={(event) => { setActualStartDateKey(event.target.value); setError(''); }} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" /></label>
                  <label className="block"><span className="mb-1.5 block text-[9px] font-medium text-slate-600">開始時刻</span><input type="time" value={actualStartTime} onChange={(event) => { setActualStartTime(event.target.value); setError(''); }} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" /></label>
                </div>
                <p className="mt-1.5 text-[8px] leading-relaxed text-slate-400">覚えていなければ空欄でOKです。開始時刻だけ分かる旧記録は、開始日を推測せずそのまま保存します。</p>
              </div>
            )}

            {(recordMode === STATUS.CHANGED || recordMode === STATUS.SKIPPED) && (
              <label className="block">
                <span className="mb-1.5 block text-[9px] font-medium text-slate-600">{recordMode === STATUS.SKIPPED ? '休んだ理由' : '変更した理由'} <span className="font-normal text-slate-400">（任意）</span></span>
                <textarea value={deviationReason} onChange={(event) => setDeviationReason(event.target.value)} rows={3} placeholder="例: 眠気が強かった / 急な連絡が入った" className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-indigo-400" />
                <span className="mt-1 block text-[8px] leading-relaxed text-slate-400">理由は評価せず、あとで振り返るための記録として使います。</span>
              </label>
            )}
          </div>
        </details>

        {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-[10px] font-medium text-rose-600">{error}</p>}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-slate-100 bg-white/96 p-3 pb-modal-safe backdrop-blur-2xl"><button type="button" onClick={submit} className="min-h-12 w-full rounded-xl bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-[0_5px_16px_rgba(79,70,229,0.18)] transition hover:bg-indigo-700 active:scale-[0.99]">この内容で記録する</button></div>
    </ModalDialog>
  );
}

function ModeButton({ active, onClick, Icon, activeClass, label }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-11 items-center justify-center gap-1 rounded-[0.65rem] px-1.5 text-center transition ${active ? activeClass : 'text-slate-500 hover:bg-white/60'}`}><Icon className={`h-4 w-4 ${active ? '' : 'text-slate-400'}`} aria-hidden="true" /><span className="text-[9px] font-medium">{label}</span></button>;
}

function MoodButton({ active, onClick, Icon, label }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-11 items-center justify-center gap-1 rounded-[0.65rem] px-1.5 text-[9px] font-medium transition ${active ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-white/60'}`}><Icon className={`h-4 w-4 ${active ? 'text-indigo-500' : 'text-slate-400'}`} aria-hidden="true" />{label}</button>;
}
