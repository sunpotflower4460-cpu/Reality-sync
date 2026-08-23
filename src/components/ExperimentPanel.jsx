import { AlertTriangle, CheckCircle2, FlaskConical, PauseCircle, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { formatShortDateLabel } from '../utils/date.js';
import {
  calculateExperimentResult,
  EXPERIMENT_DECISION,
  EXPERIMENT_STATUS,
  listEligibleExperimentRecords,
} from '../utils/experiment.js';
import { calculateRetentionSummaries, RETENTION_SIGNAL } from '../utils/retention.js';

function percent(value) { return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`; }
function signalCopy(signal) {
  if (signal === 'improving') return ['改善方向', 'text-green-700 bg-green-50'];
  if (signal === 'worsening') return ['悪化方向', 'text-red-700 bg-red-50'];
  if (signal === 'unclear') return ['まだはっきりしない', 'text-amber-700 bg-amber-50'];
  if (signal === 'review') return ['比較基準なし・要確認', 'text-gray-600 bg-gray-50'];
  return ['収集中', 'text-indigo-700 bg-indigo-50'];
}
function decisionCopy(decision) {
  if (decision === EXPERIMENT_DECISION.ADOPT) return '次の計画に採用';
  if (decision === EXPERIMENT_DECISION.REJECT) return '見送り';
  if (decision === EXPERIMENT_DECISION.HOLD) return '保留';
  return '';
}
function retentionCopy(signal) {
  if (signal === RETENTION_SIGNAL.REVIEW) return ['再検証候補', 'border-red-200 bg-red-50 text-red-700'];
  if (signal === RETENTION_SIGNAL.WATCH) return ['観測継続', 'border-amber-200 bg-amber-50 text-amber-700'];
  if (signal === RETENTION_SIGNAL.MAINTAINED) return ['維持を観測', 'border-green-200 bg-green-50 text-green-700'];
  if (signal === RETENTION_SIGNAL.UNAVAILABLE) return ['判定対象外', 'border-gray-200 bg-gray-50 text-gray-600'];
  return ['通常運用を収集中', 'border-indigo-200 bg-indigo-50 text-indigo-700'];
}

export function ExperimentPanel({ experiments, days, throughDateKey, onCaptureTrial, onRemoveTrial, onFinish, onAbandon, onDelete }) {
  if (experiments.length === 0) return null;
  const active = experiments.filter((experiment) => experiment.status === EXPERIMENT_STATUS.ACTIVE);
  const past = experiments.filter((experiment) => experiment.status !== EXPERIMENT_STATUS.ACTIVE);
  const adoptedById = new Map(experiments
    .filter((experiment) => experiment.status === EXPERIMENT_STATUS.COMPLETED && experiment.decision === EXPERIMENT_DECISION.ADOPT)
    .map((experiment) => [experiment.id, experiment]));
  const retentionSummaries = calculateRetentionSummaries(experiments, days, throughDateKey);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1"><div><h2 className="flex items-center gap-2 font-extrabold text-gray-800"><FlaskConical className="h-5 w-5 text-indigo-500" />進行中の小さな実験</h2><p className="mt-1 text-[11px] text-gray-400">対策を実際に試した回だけ明示的に登録します</p></div><span className="text-xs font-bold text-gray-400">{active.length}件</span></div>
      {active.length === 0 && <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-center text-xs text-gray-400">進行中の実験はありません。</div>}
      {active.map((experiment) => <ActiveExperiment key={experiment.id} experiment={experiment} days={days} throughDateKey={throughDateKey} onCaptureTrial={onCaptureTrial} onRemoveTrial={onRemoveTrial} onFinish={onFinish} onAbandon={onAbandon} />)}

      {retentionSummaries.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="px-1"><div className="flex items-center gap-2 text-xs font-extrabold text-gray-600"><ShieldCheck className="h-4 w-4 text-indigo-500" />採用後の学びは今も維持されている？</div><p className="mt-1 text-[10px] leading-relaxed text-gray-400">採用日以降に、その工夫が実際の計画へ反映された実績だけを通常運用として追跡します。直近最大12件を使い、8件以上・3週以上になるまでは判断を急ぎません。</p></div>
          {retentionSummaries.slice(0, 6).map((summary) => {
            const experiment = adoptedById.get(summary.experimentId);
            return experiment ? <RetentionCard key={summary.experimentId} experiment={experiment} summary={summary} /> : null;
          })}
        </div>
      )}

      {past.length > 0 && <div className="space-y-2 pt-2"><div className="px-1 text-xs font-bold text-gray-400">終了した実験</div>{past.slice(0, 6).map((experiment) => <PastExperiment key={experiment.id} experiment={experiment} onDelete={onDelete} />)}</div>}
    </section>
  );
}

function ActiveExperiment({ experiment, days, throughDateKey, onCaptureTrial, onRemoveTrial, onFinish, onAbandon }) {
  const result = calculateExperimentResult(experiment);
  const eligible = listEligibleExperimentRecords(experiment, days, throughDateKey).slice(0, 6);
  const [signal, tone] = signalCopy(result.signal);
  return (
    <article className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${tone}`}>{signal}</span><h3 className="mt-2 text-base font-extrabold leading-snug text-gray-800">{experiment.title}</h3></div><div className="shrink-0 text-right"><div className="text-2xl font-black text-indigo-600">{result.trialCount}/{experiment.targetRuns}</div><div className="text-[9px] text-gray-400">試行</div></div></div>
      <div className="mt-4 rounded-2xl bg-indigo-50 p-3"><div className="text-[10px] font-black text-indigo-500">今回の対策</div><p className="mt-1 text-xs font-medium leading-relaxed text-indigo-900">{experiment.action}</p></div>
      <div className="mt-3 grid grid-cols-3 gap-2"><Metric label="過去の失敗率" value={percent(result.baselineFailureRate)} detail={`${result.baselineSampleCount}件`} /><Metric label="実験中の失敗率" value={percent(result.failureRate)} detail={`${result.failures}/${result.trialCount || 0}件`} /><Metric label="差" value={result.differencePoints === null ? '—' : `${result.differencePoints > 0 ? '+' : ''}${result.differencePoints}pt`} detail="マイナスは改善方向" /></div>

      {experiment.trials.length > 0 && <div className="mt-4 space-y-2"><div className="text-[10px] font-black text-gray-400">登録済みの試行</div>{experiment.trials.map((trial) => <div key={trial.recordKey} className="flex items-center gap-2 rounded-xl bg-gray-50 p-2.5"><span className={`h-2.5 w-2.5 rounded-full ${trial.outcome === 'success' ? 'bg-green-500' : 'bg-orange-500'}`} /><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-gray-700">{formatShortDateLabel(trial.dateKey)} {trial.planTitle}</div><div className="text-[9px] text-gray-400">結果: {trial.observedLabel}</div></div><button type="button" onClick={() => onRemoveTrial(experiment.id, trial.recordKey)} aria-label="この試行を取り消す" className="rounded-lg p-1.5 text-gray-400 hover:bg-white"><XCircle className="h-4 w-4" /></button></div>)}</div>}

      {eligible.length > 0 && !result.targetMet && <div className="mt-4 space-y-2"><div><div className="text-[10px] font-black text-gray-400">実績済み・実験登録待ち</div><p className="mt-1 text-[9px] leading-relaxed text-gray-400">対策を実際に試した回は、良かった/悪かったに関係なく登録してください。結果を見て選ぶと比較が偏ります。</p></div>{eligible.map((record) => <div key={record.recordKey} className="rounded-xl border border-dashed border-indigo-200 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-xs font-bold text-gray-700">{formatShortDateLabel(record.dateKey)} {record.planTitle}</div><div className="mt-0.5 text-[9px] text-gray-400">この回で今回の対策を実際に試しましたか？</div></div><button type="button" onClick={() => onCaptureTrial(experiment.id, record)} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white">対策を試した</button></div></div>)}</div>}

      {result.targetMet ? <div className="mt-4 rounded-2xl border border-gray-100 p-4"><div className="text-xs font-extrabold text-gray-800">この小実験をどう扱いますか？</div><p className="mt-1 text-[10px] leading-relaxed text-gray-400">数回の結果だけで因果確定はしません。次の計画に取り入れるかは、観測結果を見た上で明示的に決めます。</p><div className="mt-3 grid grid-cols-3 gap-2"><DecisionButton label="採用" Icon={CheckCircle2} onClick={() => onFinish(experiment.id, EXPERIMENT_DECISION.ADOPT)} /><DecisionButton label="保留" Icon={PauseCircle} onClick={() => onFinish(experiment.id, EXPERIMENT_DECISION.HOLD)} /><DecisionButton label="見送り" Icon={XCircle} onClick={() => onFinish(experiment.id, EXPERIMENT_DECISION.REJECT)} /></div></div> : <button type="button" onClick={() => onAbandon(experiment.id)} className="mt-4 w-full rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-500">この実験を中止する</button>}
    </article>
  );
}

function RetentionCard({ experiment, summary }) {
  const [label, tone] = retentionCopy(summary.signal);
  const delta = summary.differenceFromExperimentPoints;
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${tone}`}>{label}</span><div className="mt-2 truncate text-xs font-extrabold text-gray-800">{experiment.title}</div></div><div className="shrink-0 text-right"><div className="text-lg font-black text-indigo-600">{summary.assessmentCount}</div><div className="text-[9px] text-gray-400">直近評価件数</div></div></div>
      <div className="mt-3 grid grid-cols-3 gap-2"><Metric label="実験中" value={percent(summary.experimentFailureRate)} detail="失敗率" /><Metric label="通常運用" value={percent(summary.failureRate)} detail={`${summary.weekCount}週`} /><Metric label="差" value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}pt`} detail="＋は悪化方向" /></div>
      {summary.interval && <p className="mt-2 text-[9px] text-gray-400">通常運用失敗率の95% Wilson区間: {percent(summary.interval.low)}–{percent(summary.interval.high)}</p>}
      <p className="mt-3 text-[10px] leading-relaxed text-gray-500">{summary.reason}</p>
      {summary.reviewCandidate && <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[10px] leading-relaxed text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>見直し候補です。</strong> 採用を自動解除せず、同じ対策を現在の条件で改めて小さく試す候補として戻します。</span></div>}
      <p className="mt-3 border-t border-gray-100 pt-2 text-[9px] leading-relaxed text-gray-400">通常運用での維持は因果効果の証明ではありません。生活条件や予定内容が変われば結果も変わり得るため、RealitySyncは一度採用した学びも固定ルール扱いしません。</p>
    </article>
  );
}

function PastExperiment({ experiment, onDelete }) {
  const result = calculateExperimentResult(experiment);
  return <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="text-xs font-extrabold text-gray-700">{experiment.title}</div><div className="mt-1 text-[10px] text-gray-400">{experiment.status === EXPERIMENT_STATUS.ABANDONED ? '中止' : decisionCopy(experiment.decision)} ・ {result.trialCount}回 ・ 実験中失敗率 {percent(result.failureRate)}</div></div><button type="button" onClick={() => onDelete(experiment.id)} aria-label="実験履歴を削除" className="rounded-lg p-1.5 text-gray-300 hover:text-red-400"><Trash2 className="h-4 w-4" /></button></div></div>;
}
function Metric({ label, value, detail }) { return <div className="rounded-xl bg-gray-50 p-2 text-center"><div className="text-[9px] font-bold text-gray-400">{label}</div><div className="mt-1 text-sm font-black text-gray-700">{value}</div><div className="text-[8px] text-gray-400">{detail}</div></div>; }
function DecisionButton({ label, Icon, onClick }) { return <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 py-2.5 text-[10px] font-bold text-gray-600"><Icon className="h-4 w-4" />{label}</button>; }
