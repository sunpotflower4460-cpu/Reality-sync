import { ArrowRight, CheckCircle2, FlaskConical, ShieldCheck, XCircle } from 'lucide-react';
import { ModalDialog } from './ModalDialog.jsx';

function percent(value) {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

function PlanSnapshot({ label, plan, tone = 'gray' }) {
  if (!plan) return null;
  const toneClass = tone === 'indigo' ? 'border-indigo-100 bg-indigo-50' : 'border-gray-100 bg-gray-50';
  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="text-[10px] font-black text-gray-400">{label}</div>
      <div className="mt-1 flex items-center gap-2"><span className="font-black text-gray-800">{plan.time}</span><span className="truncate text-sm font-bold text-gray-700">{plan.title}</span></div>
      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-gray-500"><span>{plan.category}</span><span>{plan.duration}分</span><span>想定負荷 {plan.plannedStress}</span></div>
    </div>
  );
}

export function PlanFeedbackModal({ preview, onApply, onClose }) {
  if (!preview) return null;
  return (
    <ModalDialog onClose={onClose} labelledBy="plan-feedback-title" className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-4">
        <div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-indigo-500" /><h2 id="plan-feedback-title" className="font-extrabold text-gray-800">実験で採用した工夫</h2></div>
        <button type="button" onClick={onClose} aria-label="閉じる" className="rounded-full bg-gray-100 p-1.5 text-gray-400"><XCircle className="h-5 w-5" /></button>
      </div>

      <div className="space-y-4 p-5">
        <section className="rounded-2xl bg-indigo-50 p-4">
          <div className="text-[10px] font-black text-indigo-500">採用元の実験</div>
          <h3 className="mt-1 text-sm font-extrabold leading-relaxed text-indigo-900">{preview.experimentTitle}</h3>
          <p className="mt-2 text-xs leading-relaxed text-indigo-700">{preview.action}</p>
        </section>

        {preview.contextRuleLabel && (
          <section className="rounded-2xl border border-violet-100 bg-violet-50 p-3">
            <div className="text-[10px] font-black text-violet-500">この学びを使う条件</div>
            <div className="mt-1 text-xs font-extrabold text-violet-800">{preview.contextRuleLabel}</div>
            <p className="mt-1 text-[9px] leading-relaxed text-violet-500">条件付きバージョンで検証・採用されたため、この予定が条件に一致する時だけ候補を表示しています。</p>
          </section>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Metric label="過去の失敗率" value={percent(preview.baselineFailureRate)} />
          <Metric label="実験中" value={percent(preview.experimentFailureRate)} />
          <Metric label="試行" value={`${preview.trialCount}回`} />
        </div>

        <section>
          <div className="mb-2 text-xs font-extrabold text-gray-700">今回再利用する変更</div>
          <div className="rounded-2xl border border-indigo-100 bg-white p-3 text-sm font-bold text-indigo-700">{preview.adjustmentLabel}</div>
        </section>

        <section className="space-y-2">
          <div className="text-xs font-extrabold text-gray-700">変更プレビュー</div>
          <PlanSnapshot label="変更前" plan={preview.before} />
          {preview.after && (
            <>
              <div className="flex justify-center text-indigo-400"><ArrowRight className="h-5 w-5 rotate-90" /></div>
              {preview.inserted && <PlanSnapshot label="追加する予定" plan={preview.inserted} tone="indigo" />}
              <PlanSnapshot label="変更後" plan={preview.after} tone="indigo" />
            </>
          )}
        </section>

        {!preview.canApply && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">{preview.error}</div>
        )}

        <section className="flex items-start gap-2 rounded-2xl bg-gray-50 p-3 text-[10px] leading-relaxed text-gray-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
          <p>採用済みの実験でも自動適用はしません。条件付き学習でも、このプレビューで現在の予定だけを確認してから反映します。実績がある予定や、重なり・日跨ぎが発生する変更は止めます。</p>
        </section>
      </div>

      <div className="sticky bottom-0 border-t border-gray-100 bg-white p-4">
        {preview.canApply ? (
          <button type="button" onClick={onApply} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 font-bold text-white"><CheckCircle2 className="h-5 w-5" />この変更を予定へ反映</button>
        ) : (
          <button type="button" onClick={onClose} className="w-full rounded-xl bg-gray-100 py-3.5 font-bold text-gray-600">確認して閉じる</button>
        )}
      </div>
    </ModalDialog>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl bg-gray-50 p-2 text-center"><div className="text-[9px] font-bold text-gray-400">{label}</div><div className="mt-1 text-sm font-black text-gray-700">{value}</div></div>;
}
