import { useMemo, useState } from 'react';
import { History, RefreshCcw, ShieldCheck, XCircle } from 'lucide-react';
import { formatShortDateLabel, shiftDateKey } from '../utils/date.js';
import { PLAN_ADJUSTMENT_KIND, planAdjustmentLabel } from '../utils/experiment.js';
import { ModalDialog } from './ModalDialog.jsx';

const ADJUSTMENT_OPTIONS = [
  { value: 'buffer-15', adjustment: { kind: PLAN_ADJUSTMENT_KIND.BUFFER_BEFORE, minutes: 15 } },
  { value: 'buffer-30', adjustment: { kind: PLAN_ADJUSTMENT_KIND.BUFFER_BEFORE, minutes: 30 } },
  { value: 'shorten-15', adjustment: { kind: PLAN_ADJUSTMENT_KIND.SHORTEN_DURATION, minutes: 15 } },
  { value: 'shift-15', adjustment: { kind: PLAN_ADJUSTMENT_KIND.SHIFT_START_LATER, minutes: 15 } },
  { value: 'none', adjustment: null },
];

function optionValue(adjustment) {
  if (!adjustment) return 'none';
  return ADJUSTMENT_OPTIONS.find((option) => option.adjustment?.kind === adjustment.kind && option.adjustment?.minutes === adjustment.minutes)?.value ?? 'none';
}

function percent(value) {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

export function RevalidationSetupModal({ sourceExperiment, retentionSummary, proposedVersion, dateKey, onStart, onClose }) {
  const effectiveStartDate = shiftDateKey(dateKey, 1);
  const [action, setAction] = useState(sourceExperiment.action);
  const [targetRuns, setTargetRuns] = useState(3);
  const [adjustmentValue, setAdjustmentValue] = useState(() => optionValue(sourceExperiment.planAdjustment));
  const [error, setError] = useState('');
  const planAdjustment = useMemo(
    () => ADJUSTMENT_OPTIONS.find((option) => option.value === adjustmentValue)?.adjustment ?? null,
    [adjustmentValue],
  );

  const submit = () => {
    if (!action.trim()) { setError('今回再検証する対策を入力してください。'); return; }
    const ok = onStart(sourceExperiment.id, retentionSummary, {
      action: action.trim(),
      planAdjustment,
      targetRuns,
    });
    if (!ok) { setError('現在の評価境界では安全に再検証を開始できませんでした。最新の「今日」の傾向を確認してください。'); return; }
    onClose();
  };

  return (
    <ModalDialog onClose={onClose} labelledBy="revalidation-title" className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-4">
        <div className="flex items-center gap-2"><RefreshCcw className="h-5 w-5 text-indigo-500" /><h2 id="revalidation-title" className="font-extrabold text-gray-800">学びを再検証する</h2></div>
        <button type="button" onClick={onClose} aria-label="閉じる" className="rounded-full bg-gray-100 p-1.5 text-gray-400"><XCircle className="h-5 w-5" /></button>
      </div>

      <div className="space-y-5 p-5">
        <section className="rounded-2xl bg-indigo-50 p-4">
          <div className="flex items-center justify-between gap-2"><div className="text-[10px] font-black text-indigo-500">学びの更新</div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-indigo-600">v{sourceExperiment.learningVersion || 1} → v{proposedVersion}</span></div>
          <h3 className="mt-2 text-sm font-extrabold leading-relaxed text-indigo-900">{sourceExperiment.title}</h3>
          <p className="mt-2 text-xs leading-relaxed text-indigo-700">元の学びは残したまま、新しい実験として現在の条件で確かめ直します。</p>
        </section>

        <section className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-[10px] font-black text-red-600"><History className="h-4 w-4" />再検証する理由</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Metric label="実験中" value={percent(retentionSummary.experimentFailureRate)} />
            <Metric label="通常運用" value={percent(retentionSummary.failureRate)} />
            <Metric label="差" value={`${retentionSummary.differenceFromExperimentPoints > 0 ? '+' : ''}${retentionSummary.differenceFromExperimentPoints}pt`} />
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-red-700">この通常運用の直近{retentionSummary.assessmentCount}件・{retentionSummary.weekCount}週を、新しいv{proposedVersion}の比較基準として固定します。</p>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
          <div className="text-[10px] font-black text-gray-400">新しい実験の有効開始日</div>
          <div className="mt-1 text-sm font-extrabold text-gray-700">{formatShortDateLabel(effectiveStartDate)}</div>
          <p className="mt-1 text-[9px] leading-relaxed text-gray-400">今日までの通常運用を後付けで新しい実験へ混ぜないため、翌日以降だけを対象にします。</p>
        </section>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-gray-700">今回試す対策</span>
          <textarea rows={4} value={action} onChange={(event) => { setAction(event.target.value); setError(''); }} className="w-full resize-none rounded-2xl border border-gray-200 p-3 text-sm outline-none focus:border-indigo-400" />
          <span className="mt-1 block text-[10px] leading-relaxed text-gray-400">前バージョンと同じ対策を再確認しても、条件を少し変えても構いません。文章から計画変更を推測することはありません。</span>
        </label>

        <label className="block rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <span className="mb-2 block text-sm font-bold text-gray-700">採用した場合に再利用する計画変更</span>
          <select value={adjustmentValue} onChange={(event) => setAdjustmentValue(event.target.value)} className="w-full rounded-xl border border-indigo-100 bg-white p-3 text-sm text-gray-700">
            {ADJUSTMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{planAdjustmentLabel(option.adjustment)}</option>)}
          </select>
          <span className="mt-2 block text-[10px] leading-relaxed text-gray-500">v{proposedVersion}を採用した場合だけ、この構造化変更が将来の計画候補になります。v{sourceExperiment.learningVersion || 1}の履歴は消しません。</span>
        </label>

        <label className="block"><span className="mb-2 block text-sm font-bold text-gray-700">まず何回試すか</span><select value={targetRuns} onChange={(event) => setTargetRuns(Number(event.target.value))} className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm">{[3,4,5,6,8,10].map((value) => <option key={value} value={value}>{value}回</option>)}</select></label>

        <section className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>再検証で改善しても、前バージョンが「間違いだった」とは断定しません。生活条件が変わった可能性も含め、各バージョンをその時点の観測履歴として残します。</p></section>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600">{error}</p>}
      </div>

      <div className="sticky bottom-0 border-t border-gray-100 bg-white p-4"><button type="button" onClick={submit} className="w-full rounded-xl bg-indigo-600 py-3.5 font-bold text-white">v{proposedVersion}として再検証を開始</button></div>
    </ModalDialog>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl bg-white/80 p-2"><div className="text-[9px] font-bold text-red-400">{label}</div><div className="mt-1 text-sm font-black text-red-700">{value}</div></div>;
}
