import { useState } from 'react';
import { FlaskConical, ShieldCheck, XCircle } from 'lucide-react';
import { experimentBlueprintForCandidate } from '../utils/experiment.js';
import { ModalDialog } from './ModalDialog.jsx';

export function ExperimentSetupModal({ candidate, dateKey, days, onStart, onClose }) {
  const blueprint = experimentBlueprintForCandidate(candidate);
  const [action, setAction] = useState(blueprint?.actionSuggestion ?? '');
  const [targetRuns, setTargetRuns] = useState(3);
  const [error, setError] = useState('');

  const submit = () => {
    if (!action.trim()) { setError('今回試す対策を入力してください。'); return; }
    const ok = onStart(candidate, { startDateKey: dateKey, anchorDateKey: dateKey, days, action: action.trim(), targetRuns });
    if (!ok) { setError('この候補からは安全に実験を作成できませんでした。'); return; }
    onClose();
  };

  return (
    <ModalDialog onClose={onClose} labelledBy="experiment-setup-title" className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-4">
        <div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-indigo-500" /><h2 id="experiment-setup-title" className="font-extrabold text-gray-800">小さな実験を始める</h2></div>
        <button type="button" onClick={onClose} aria-label="閉じる" className="rounded-full bg-gray-100 p-1.5 text-gray-400"><XCircle className="h-5 w-5" /></button>
      </div>
      <div className="space-y-5 p-5">
        <section className="rounded-2xl bg-indigo-50 p-4"><div className="text-[10px] font-black text-indigo-500">元の候補</div><h3 className="mt-1 text-sm font-extrabold leading-relaxed text-indigo-900">{candidate.title}</h3><p className="mt-2 text-xs leading-relaxed text-indigo-700">{candidate.hypothesis}</p></section>
        <label className="block"><span className="mb-2 block text-sm font-bold text-gray-700">今回だけ試す対策</span><textarea rows={4} value={action} onChange={(event) => { setAction(event.target.value); setError(''); }} className="w-full resize-none rounded-2xl border border-gray-200 p-3 text-sm outline-none focus:border-indigo-400" /><span className="mt-1 block text-[10px] leading-relaxed text-gray-400">自動で予定を書き換えません。実際にこの対策を試した回だけ、あとで実験へ登録します。</span></label>
        <label className="block"><span className="mb-2 block text-sm font-bold text-gray-700">まず何回試すか</span><select value={targetRuns} onChange={(event) => setTargetRuns(Number(event.target.value))} className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm">{[3,4,5,6,8,10].map((value) => <option key={value} value={value}>{value}回</option>)}</select></label>
        <section className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>数回の小実験だけで因果を証明しません。結果は「改善方向 / はっきりしない / 悪化方向」の観測として出し、採用・保留・見送りは明示的に決めます。</p></section>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600">{error}</p>}
      </div>
      <div className="sticky bottom-0 border-t border-gray-100 bg-white p-4"><button type="button" onClick={submit} className="w-full rounded-xl bg-indigo-600 py-3.5 font-bold text-white">この条件で実験を開始</button></div>
    </ModalDialog>
  );
}
