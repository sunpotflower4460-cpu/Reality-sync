import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, GitBranch, PauseCircle, RefreshCcw, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { contextRuleLabel } from '../utils/contextRule.js';
import { formatShortDateLabel, isToday } from '../utils/date.js';
import {
  buildLearningLineages,
  calculateExperimentResult,
  EXPERIMENT_DECISION,
  EXPERIMENT_STATUS,
  listEligibleExperimentRecords,
  nextLearningVersion,
  planAdjustmentLabel,
} from '../utils/experiment.js';
import { calculateRetentionSummaries, RETENTION_SIGNAL } from '../utils/retention.js';
import { calculateScopePrecisionSummary, SCOPE_PRECISION_SIGNAL } from '../utils/scopePrecision.js';
import { RevalidationSetupModal } from './RevalidationSetupModal.jsx';

function percent(value) { return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`; }
function signalCopy(signal) {
  if (signal === 'improving') return ['改善方向', 'text-green-700 bg-green-50'];
  if (signal === 'worsening') return ['悪化方向', 'text-red-700 bg-red-50'];
  if (signal === 'unclear') return ['まだはっきりしない', 'text-amber-700 bg-amber-50'];
  if (signal === 'review') return ['比較基準なし・要確認', 'text-gray-600 bg-gray-50'];
  return ['収集中', 'text-indigo-700 bg-indigo-50'];
}
function decisionCopy(decision) {
  if (decision === EXPERIMENT_DECISION.ADOPT) return '採用';
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
function scopePrecisionCopy(signal) {
  if (signal === SCOPE_PRECISION_SIGNAL.FOCUSED) return ['高リスク側を切り分ける方向', 'border-green-200 bg-green-50 text-green-700'];
  if (signal === SCOPE_PRECISION_SIGNAL.REVERSE) return ['条件外も要確認', 'border-red-200 bg-red-50 text-red-700'];
  if (signal === SCOPE_PRECISION_SIGNAL.UNCLEAR) return ['切り分けはまだ不明瞭', 'border-amber-200 bg-amber-50 text-amber-700'];
  if (signal === SCOPE_PRECISION_SIGNAL.UNAVAILABLE) return ['比較できません', 'border-gray-200 bg-gray-50 text-gray-600'];
  return ['条件精度を収集中', 'border-violet-200 bg-violet-50 text-violet-700'];
}
function versionBadge(experiment) { return `v${experiment.learningVersion || 1}`; }

export function ExperimentPanel({ experiments, days, throughDateKey, onCaptureTrial, onRemoveTrial, onFinish, onAbandon, onDelete, onStartRevalidation }) {
  const [revalidationTarget, setRevalidationTarget] = useState(null);
  if (experiments.length === 0) return null;
  const active = experiments.filter((experiment) => experiment.status === EXPERIMENT_STATUS.ACTIVE);
  const past = experiments.filter((experiment) => experiment.status !== EXPERIMENT_STATUS.ACTIVE);
  const adoptedById = new Map(experiments
    .filter((experiment) => experiment.status === EXPERIMENT_STATUS.COMPLETED && experiment.decision === EXPERIMENT_DECISION.ADOPT)
    .map((experiment) => [experiment.id, experiment]));
  const activeRootIds = new Set(active.map((experiment) => experiment.learningRootId || experiment.id));
  const retentionSummaries = calculateRetentionSummaries(experiments, days, throughDateKey);
  const lineages = buildLearningLineages(experiments);
  const versionedLineages = lineages.filter((lineage) => lineage.versions.length > 1);
  const todayView = isToday(throughDateKey);

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
            if (!experiment) return null;
            const rootId = experiment.learningRootId || experiment.id;
            const canRevalidate = summary.reviewCandidate && todayView && !activeRootIds.has(rootId);
            const scopePrecision = calculateScopePrecisionSummary(experiment, experiments, days, throughDateKey);
            return <RetentionCard key={summary.experimentId} experiment={experiment} summary={summary} scopePrecision={scopePrecision} canRevalidate={canRevalidate} todayView={todayView} onRevalidate={() => setRevalidationTarget({ experiment, summary })} />;
          })}
        </div>
      )}

      {versionedLineages.length > 0 && <LearningHistory lineages={versionedLineages.slice(0, 6)} />}

      {past.length > 0 && <div className="space-y-2 pt-2"><div className="px-1 text-xs font-bold text-gray-400">終了した実験</div>{past.slice(0, 8).map((experiment) => <PastExperiment key={experiment.id} experiment={experiment} onDelete={onDelete} hasChildren={experiments.some((item) => item.parentExperimentId === experiment.id)} />)}</div>}

      {revalidationTarget && (
        <RevalidationSetupModal
          sourceExperiment={revalidationTarget.experiment}
          retentionSummary={revalidationTarget.summary}
          proposedVersion={nextLearningVersion(experiments, revalidationTarget.experiment)}
          dateKey={throughDateKey}
          days={days}
          onStart={onStartRevalidation}
          onClose={() => setRevalidationTarget(null)}
        />
      )}
    </section>
  );
}

function ActiveExperiment({ experiment, days, throughDateKey, onCaptureTrial, onRemoveTrial, onFinish, onAbandon }) {
  const result = calculateExperimentResult(experiment);
  const eligible = listEligibleExperimentRecords(experiment, days, throughDateKey).slice(0, 6);
  const [signal, tone] = signalCopy(result.signal);
  return (
    <article className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${tone}`}>{signal}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-500">{versionBadge(experiment)}</span></div><h3 className="mt-2 text-base font-extrabold leading-snug text-gray-800">{experiment.title}</h3>{experiment.parentExperimentId && <p className="mt-1 text-[9px] font-bold text-indigo-500">再検証バージョン ・ 前版のRetentionから開始</p>}</div><div className="shrink-0 text-right"><div className="text-2xl font-black text-indigo-600">{result.trialCount}/{experiment.targetRuns}</div><div className="text-[9px] text-gray-400">試行</div></div></div>
      {experiment.revalidationReason && <div className="mt-3 rounded-xl bg-red-50 p-3 text-[10px] leading-relaxed text-red-700">{experiment.revalidationReason}</div>}
      {experiment.contextRule && <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-[10px] font-bold leading-relaxed text-violet-700">条件付き: {contextRuleLabel(experiment.contextRule)}</div>}
      <div className="mt-4 rounded-2xl bg-indigo-50 p-3"><div className="text-[10px] font-black text-indigo-500">今回の対策</div><p className="mt-1 text-xs font-medium leading-relaxed text-indigo-900">{experiment.action}</p></div>
      <div className="mt-3 grid grid-cols-3 gap-2"><Metric label={experiment.parentExperimentId ? '再検証前' : '過去の失敗率'} value={percent(result.baselineFailureRate)} detail={`${result.baselineSampleCount}件`} /><Metric label="実験中の失敗率" value={percent(result.failureRate)} detail={`${result.failures}/${result.trialCount || 0}件`} /><Metric label="差" value={result.differencePoints === null ? '—' : `${result.differencePoints > 0 ? '+' : ''}${result.differencePoints}pt`} detail="マイナスは改善方向" /></div>

      {experiment.trials.length > 0 && <div className="mt-4 space-y-2"><div className="text-[10px] font-black text-gray-400">登録済みの試行</div>{experiment.trials.map((trial) => <div key={trial.recordKey} className="flex items-center gap-2 rounded-xl bg-gray-50 p-2.5"><span className={`h-2.5 w-2.5 rounded-full ${trial.outcome === 'success' ? 'bg-green-500' : 'bg-orange-500'}`} /><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-gray-700">{formatShortDateLabel(trial.dateKey)} {trial.planTitle}</div><div className="text-[9px] text-gray-400">結果: {trial.observedLabel}</div></div><button type="button" onClick={() => onRemoveTrial(experiment.id, trial.recordKey)} aria-label="この試行を取り消す" className="rounded-lg p-1.5 text-gray-400 hover:bg-white"><XCircle className="h-4 w-4" /></button></div>)}</div>}

      {eligible.length > 0 && !result.targetMet && <div className="mt-4 space-y-2"><div><div className="text-[10px] font-black text-gray-400">実績済み・実験登録待ち</div><p className="mt-1 text-[9px] leading-relaxed text-gray-400">対策を実際に試した回は、良かった/悪かったに関係なく登録してください。条件付き実験では、固定した条件を満たす回だけここへ出ます。</p></div>{eligible.map((record) => <div key={record.recordKey} className="rounded-xl border border-dashed border-indigo-200 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-xs font-bold text-gray-700">{formatShortDateLabel(record.dateKey)} {record.planTitle}</div><div className="mt-0.5 text-[9px] text-gray-400">この回で今回の対策を実際に試しましたか？</div></div><button type="button" onClick={() => onCaptureTrial(experiment.id, record)} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white">対策を試した</button></div></div>)}</div>}

      {result.targetMet ? <div className="mt-4 rounded-2xl border border-gray-100 p-4"><div className="text-xs font-extrabold text-gray-800">この小実験をどう扱いますか？</div><p className="mt-1 text-[10px] leading-relaxed text-gray-400">数回の結果だけで因果確定はしません。次の計画に取り入れるかは、観測結果を見た上で明示的に決めます。</p><div className="mt-3 grid grid-cols-3 gap-2"><DecisionButton label="採用" Icon={CheckCircle2} onClick={() => onFinish(experiment.id, EXPERIMENT_DECISION.ADOPT)} /><DecisionButton label="保留" Icon={PauseCircle} onClick={() => onFinish(experiment.id, EXPERIMENT_DECISION.HOLD)} /><DecisionButton label="見送り" Icon={XCircle} onClick={() => onFinish(experiment.id, EXPERIMENT_DECISION.REJECT)} /></div></div> : <button type="button" onClick={() => onAbandon(experiment.id)} className="mt-4 w-full rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-500">この実験を中止する</button>}
    </article>
  );
}

function RetentionCard({ experiment, summary, scopePrecision, canRevalidate, todayView, onRevalidate }) {
  const [label, tone] = retentionCopy(summary.signal);
  const delta = summary.differenceFromExperimentPoints;
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${tone}`}>{label}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-500">{versionBadge(experiment)}</span></div><div className="mt-2 truncate text-xs font-extrabold text-gray-800">{experiment.title}</div>{experiment.contextRule && <div className="mt-1 text-[9px] font-bold text-violet-500">{contextRuleLabel(experiment.contextRule)}</div>}</div><div className="shrink-0 text-right"><div className="text-lg font-black text-indigo-600">{summary.assessmentCount}</div><div className="text-[9px] text-gray-400">直近評価件数</div></div></div>
      <div className="mt-3 grid grid-cols-3 gap-2"><Metric label="実験中" value={percent(summary.experimentFailureRate)} detail="失敗率" /><Metric label="通常運用" value={percent(summary.failureRate)} detail={`${summary.weekCount}週`} /><Metric label="差" value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}pt`} detail="＋は悪化方向" /></div>
      {summary.interval && <p className="mt-2 text-[9px] text-gray-400">通常運用失敗率の95% Wilson区間: {percent(summary.interval.low)}–{percent(summary.interval.high)}</p>}
      <p className="mt-3 text-[10px] leading-relaxed text-gray-500">{summary.reason}</p>
      {scopePrecision && <ScopePrecisionCard summary={scopePrecision} />}
      {summary.reviewCandidate && <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[10px] leading-relaxed text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>見直し候補です。</strong> 採用を自動解除せず、現在の通常運用を比較基準にした新しいバージョンで確かめ直せます。</span></div>}
      {summary.reviewCandidate && <button type="button" disabled={!canRevalidate} onClick={onRevalidate} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white disabled:bg-gray-300"><RefreshCcw className="h-4 w-4" />{canRevalidate ? `v${nextLearningVersion([], experiment)}以降として再検証` : !todayView ? '今日のRetentionで再確認して開始' : '同じ学びを別バージョンで検証中'}</button>}
      <p className="mt-3 border-t border-gray-100 pt-2 text-[9px] leading-relaxed text-gray-400">通常運用での維持は因果効果の証明ではありません。生活条件や予定内容が変われば結果も変わり得るため、RealitySyncは一度採用した学びも固定ルール扱いしません。</p>
    </article>
  );
}

function ScopePrecisionCard({ summary }) {
  const [label, tone] = scopePrecisionCopy(summary.signal);
  const source = summary.source;
  const coverage = summary.coverage;
  return (
    <section className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-3">
      <div className="flex items-center justify-between gap-2"><div className="text-[10px] font-black text-violet-600">条件の切り分け精度</div><span className={`rounded-full border px-2 py-1 text-[9px] font-black ${tone}`}>{label}</span></div>
      <p className="mt-2 text-[10px] leading-relaxed text-gray-600">{summary.reason}</p>
      {source && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="前版・条件内" value={percent(source.inside.failureRate)} detail={`${source.inside.count}件 / ${source.inside.weekCount}週`} />
            <Metric label="前版・条件外" value={percent(source.outside.failureRate)} detail={`${source.outside.count}件 / ${source.outside.weekCount}週`} />
            <Metric label="内−外" value={source.differencePoints === null ? '—' : `${source.differencePoints > 0 ? '+' : ''}${source.differencePoints}pt`} detail="＋は条件内が高い" />
          </div>
          {source.parentScopeRestricted && <p className="mt-2 text-[9px] leading-relaxed text-gray-400">前版にも条件があったため、その前版の適用範囲内だけで今回の条件を比較しています。</p>}
          {!source.sameStructuredAdjustmentAsParent && <p className="mt-2 text-[9px] leading-relaxed text-gray-400">前版と今回で構造化された計画変更が異なるため、この比較は「条件の切り分け」の参考であり、今回の対策そのものの条件外効果ではありません。</p>}
          {source.unknownCount > 0 && <p className="mt-2 text-[9px] leading-relaxed text-gray-400">履歴条件を安全に判定できない前版記録 {source.unknownCount}件は内外どちらにも入れていません。</p>}
        </>
      )}
      {coverage && coverage.baseConditionCount > 0 && (
        <div className="mt-3 rounded-xl bg-white p-3">
          <div className="text-[9px] font-black text-violet-500">採用後のCoverage</div>
          <p className="mt-1 text-[10px] leading-relaxed text-gray-600">基本条件の記録 {coverage.baseConditionCount}件中、条件判定できた{coverage.knownScopeCount}件のうち{coverage.insideCount}件（{percent(coverage.ruleCoverage)}）が条件内です。条件内で今回の工夫が実際に反映されたのは{coverage.insideAppliedCount}/{coverage.insideCount}件（{percent(coverage.applicationCoverage)}）です。</p>
          {coverage.unknownCount > 0 && <p className="mt-1 text-[9px] text-gray-400">条件を安全に判定できない記録: {coverage.unknownCount}件</p>}
          {coverage.outsideAppliedCount > 0 && <p className="mt-2 text-[9px] font-medium leading-relaxed text-red-600">条件外なのにこの実験IDの適用記録が{coverage.outsideAppliedCount}件あります。自動的に成功/失敗の根拠へ混ぜず、記録整合性の確認対象として扱います。</p>}
        </div>
      )}
      <p className="mt-3 border-t border-violet-100 pt-2 text-[9px] leading-relaxed text-gray-400">条件外で現在の対策を十分な回数、明示的に試した記録がない限り、「条件外では効かない / 効く」とは推定しません。そこを確かめるには、別の検証が必要です。</p>
    </section>
  );
}

function LearningHistory({ lineages }) {
  return (
    <div className="space-y-2 pt-2">
      <div className="px-1"><div className="flex items-center gap-2 text-xs font-extrabold text-gray-600"><GitBranch className="h-4 w-4 text-indigo-500" />学びのバージョン履歴</div><p className="mt-1 text-[10px] leading-relaxed text-gray-400">再検証しても以前の結果は上書きしません。各バージョンを、その時点の生活条件で得た観測として残します。</p></div>
      {lineages.map((lineage) => <article key={lineage.rootId} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><div className="text-xs font-extrabold text-gray-800">{lineage.title}</div><div className="mt-3 space-y-2">{lineage.versions.map((version, index) => <div key={version.id} className="flex items-start gap-3"><div className="flex flex-col items-center"><span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-indigo-50 px-2 text-[10px] font-black text-indigo-600">v{version.learningVersion || 1}</span>{index < lineage.versions.length - 1 && <span className="mt-1 h-5 w-px bg-indigo-100" />}</div><div className="min-w-0 flex-1 pb-2"><div className="text-[10px] font-bold text-gray-600">{version.status === EXPERIMENT_STATUS.ACTIVE ? '検証中' : version.status === EXPERIMENT_STATUS.ABANDONED ? '中止' : decisionCopy(version.decision)}</div><div className="mt-0.5 text-[9px] leading-relaxed text-gray-400">{version.action}</div>{version.contextRule && <div className="mt-1 text-[9px] font-bold text-violet-500">{contextRuleLabel(version.contextRule)}</div>}<div className="mt-1 text-[9px] text-indigo-400">{planAdjustmentLabel(version.planAdjustment)}</div></div></div>)}</div></article>)}
    </div>
  );
}

function PastExperiment({ experiment, onDelete, hasChildren }) {
  const result = calculateExperimentResult(experiment);
  return <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] font-black text-gray-500">{versionBadge(experiment)}</span><div className="truncate text-xs font-extrabold text-gray-700">{experiment.title}</div></div><div className="mt-1 text-[10px] text-gray-400">{experiment.status === EXPERIMENT_STATUS.ABANDONED ? '中止' : decisionCopy(experiment.decision)} ・ {result.trialCount}回 ・ 実験中失敗率 {percent(result.failureRate)}</div>{experiment.contextRule && <div className="mt-1 text-[9px] font-bold text-violet-500">{contextRuleLabel(experiment.contextRule)}</div>}</div>{!hasChildren && <button type="button" onClick={() => onDelete(experiment.id)} aria-label="実験履歴を削除" className="rounded-lg p-1.5 text-gray-300 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}</div>{hasChildren && <p className="mt-2 text-[9px] text-gray-400">後続バージョンの親履歴なので削除できません。</p>}</div>;
}
function Metric({ label, value, detail }) { return <div className="rounded-xl bg-gray-50 p-2 text-center"><div className="text-[9px] font-bold text-gray-400">{label}</div><div className="mt-1 text-sm font-black text-gray-700">{value}</div><div className="text-[8px] text-gray-400">{detail}</div></div>; }
function DecisionButton({ label, Icon, onClick }) { return <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 py-2.5 text-[10px] font-bold text-gray-600"><Icon className="h-4 w-4" />{label}</button>; }
