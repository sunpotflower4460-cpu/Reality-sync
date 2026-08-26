import { ArrowRight, CheckCircle2, Lightbulb, ShieldCheck, XCircle } from 'lucide-react';
import { ModalDialog } from './ModalDialog.jsx';

function PlanSnapshot({ label, plan, tone = 'gray' }) {
  if (!plan) return null;
  const toneClass = tone === 'indigo' ? 'border-indigo-100 bg-indigo-50' : 'border-slate-100 bg-slate-50';
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="text-[9px] font-black text-slate-400">{label}</div>
      <div className="mt-1 flex items-center gap-2"><span className="text-[12px] font-black text-slate-800">{plan.time}</span><span className="truncate text-[12px] font-extrabold text-slate-700">{plan.title}</span></div>
      <div className="mt-1 flex flex-wrap gap-2 text-[9px] text-slate-500"><span>{plan.category}</span><span>{plan.duration}分</span><span>想定負荷 {plan.plannedStress}</span></div>
    </div>
  );
}

export function PlanFeedbackModal({ preview, onApply, onClose }) {
  if (!preview) return null;
  return (
    <ModalDialog
      onClose={onClose}
      labelledBy="plan-feedback-title"
      placement="sheet"
      className="max-h-[94dvh] w-full max-w-sm overflow-y-auto rounded-t-[1.75rem] rounded-b-none bg-[#f7f8fb] shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:rounded-[1.75rem]"
    >
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/96 px-4 pb-3 pt-2 backdrop-blur-xl sm:pt-4">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-indigo-500" /><h2 id="plan-feedback-title" className="text-[13px] font-black text-slate-800">前の記録からのヒント</h2></div>
          <button type="button" onClick={onClose} aria-label="閉じる" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400"><XCircle className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <section className="rounded-[1.2rem] bg-indigo-50 p-3.5">
          <div className="text-[9px] font-black text-indigo-500">こんな調整が合いそうです</div>
          <p className="mt-1.5 text-[13px] font-extrabold leading-relaxed text-indigo-900">{preview.adjustmentLabel}</p>
          {preview.action && <p className="mt-1.5 text-[10px] leading-relaxed text-indigo-700">{preview.action}</p>}
        </section>

        {preview.contextRuleLabel && (
          <section className="rounded-xl border border-violet-100 bg-violet-50 p-3">
            <div className="text-[9px] font-black text-violet-500">このヒントが合いやすい条件</div>
            <div className="mt-1 text-[10px] font-extrabold text-violet-800">{preview.contextRuleLabel}</div>
          </section>
        )}

        <section className="space-y-2">
          <div className="text-[10px] font-extrabold text-slate-600">予定はこう変わります</div>
          <PlanSnapshot label="変更前" plan={preview.before} />
          {preview.after && (
            <>
              <div className="flex justify-center text-indigo-400"><ArrowRight className="h-4 w-4 rotate-90" /></div>
              {preview.inserted && <PlanSnapshot label="追加する予定" plan={preview.inserted} tone="indigo" />}
              <PlanSnapshot label="変更後" plan={preview.after} tone="indigo" />
            </>
          )}
        </section>

        {!preview.canApply && <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-800">{preview.error}</div>}

        <section className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[9px] leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
          <p>RealitySyncが予定を勝手に変えることはありません。良さそうな時だけ自分で反映できます。実績がある予定や、重なり・日跨ぎが起きる変更は止めます。</p>
        </section>
      </div>

      <div className="sticky bottom-0 border-t border-slate-100 bg-white/96 p-3 pb-modal-safe backdrop-blur-xl">
        {preview.canApply ? (
          <button type="button" onClick={onApply} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-[12px] font-extrabold text-white"><CheckCircle2 className="h-4 w-4" />この調整を予定へ反映</button>
        ) : (
          <button type="button" onClick={onClose} className="min-h-12 w-full rounded-xl bg-slate-100 px-4 text-[12px] font-extrabold text-slate-600">確認して閉じる</button>
        )}
      </div>
    </ModalDialog>
  );
}
