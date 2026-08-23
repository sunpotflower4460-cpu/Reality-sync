import { useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, FlaskConical, History, Info, Lock, ShieldCheck } from 'lucide-react';
import { formatShortDateLabel } from '../utils/date.js';
import { canCreateExperiment, EXPERIMENT_STATUS } from '../utils/experiment.js';
import { ExperimentPanel } from './ExperimentPanel.jsx';
import { ExperimentSetupModal } from './ExperimentSetupModal.jsx';

const EVIDENCE_STYLE = {
  stable: 'border-green-200 bg-green-50 text-green-700',
  repeated: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  emerging: 'border-amber-200 bg-amber-50 text-amber-700',
};

function stageCopy(stage) {
  if (stage === 'screening') return '候補スクリーニング可能';
  if (stage === 'collecting') return '反復データを収集中';
  return '観測を始めた段階';
}

export function InsightCandidatesView({
  insights,
  experiments = [],
  days = {},
  selectedDate,
  onStartExperiment,
  onCaptureTrial,
  onRemoveTrial,
  onFinishExperiment,
  onAbandonExperiment,
  onDeleteExperiment,
}) {
  const [setupCandidate, setSetupCandidate] = useState(null);
  const { readiness, candidates, screenedCandidateCount } = insights;
  const period = readiness.firstDate && readiness.lastDate
    ? `${formatShortDateLabel(readiness.firstDate)} – ${formatShortDateLabel(readiness.lastDate)}`
    : 'まだ記録期間がありません';
  const activeCandidateIds = new Set(experiments.filter((experiment) => experiment.status === EXPERIMENT_STATUS.ACTIVE).map((experiment) => experiment.candidateId));

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm">
        <div className="bg-indigo-600 p-5 text-white">
          <div className="flex items-center gap-2"><FlaskConical className="h-5 w-5" /><h2 className="font-extrabold">観測インサイト</h2></div>
          <p className="mt-2 text-xs leading-relaxed text-indigo-100">答えを断定する場所ではなく、次に確かめる価値があるパターンを、根拠と不確実性つきで並べます。</p>
        </div>
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><div className="text-xs font-bold text-gray-400">現在の段階</div><div className="mt-1 font-extrabold text-gray-800">{stageCopy(readiness.stage)}</div></div>
            <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-600">直近{readiness.windowDays}日</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ReadinessMetric label="記録済み" value={`${readiness.recordedCount}件`} detail={`${readiness.monthCount}か月で観測`} />
            <ReadinessMetric label="記録時の予定保存" value={`${readiness.snapshotCoverage}%`} detail={`${readiness.snapshotCount}/${readiness.recordedCount || 0}件`} />
            <ReadinessMetric label="正確な開始日時" value={`${readiness.exactTimingCount}件`} detail="予定スナップショット付き" />
            <ReadinessMetric label="理由付きのズレ" value={`${readiness.reasonCount}件`} detail="変更・スキップのみ" />
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-500"><History className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /><span>観測期間: {period}。古い実績に記録時の予定スナップショットがない場合、予定内容や想定負荷を使う候補分析からは除外します。</span></div>
        </div>
      </section>

      <ExperimentPanel
        experiments={experiments}
        days={days}
        throughDateKey={selectedDate}
        onCaptureTrial={onCaptureTrial}
        onRemoveTrial={onRemoveTrial}
        onFinish={onFinishExperiment}
        onAbandon={onAbandonExperiment}
        onDelete={onDeleteExperiment}
      />

      {candidates.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-indigo-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-500"><BarChart3 className="h-5 w-5" /></div>
          <h2 className="font-extrabold text-gray-800">まだ十分に分かれた候補はありません</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">これは「何も起きていない」という意味ではありません。比較群の最低件数と15pt以上の差を満たすまでは、偶然の揺れをインサイトとして昇格させません。</p>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 px-1"><div><h2 className="font-extrabold text-gray-800">今見る価値がある候補</h2><p className="mt-1 text-[11px] text-gray-400">最大6件を、反復性と差の大きさで並べています</p></div><span className="text-xs font-bold text-gray-400">候補 {screenedCandidateCount}件</span></div>
          {candidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} experimentActive={activeCandidateIds.has(candidate.id)} onExperiment={() => setSetupCandidate(candidate)} />)}
        </section>
      )}

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-extrabold text-gray-800"><ShieldCheck className="h-5 w-5 text-indigo-500" />この画面が断定しないこと</h2>
        <div className="mt-4 space-y-3 text-xs leading-relaxed text-gray-500">
          <Rule Icon={CheckCircle2}>率の比較は最低サンプル数を満たし、15ポイント未満の差は候補にしません。</Rule>
          <Rule Icon={Info}>95% Wilson区間は率の不確実性を見る補助です。「有意差」や因果を保証するものではありません。</Rule>
          <Rule Icon={AlertTriangle}>複数の曜日・カテゴリ等を同時に探索するため、偶然大きく見える差が混ざる可能性があります。小実験も因果証明ではなく、次の判断材料として扱います。</Rule>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <Lock className="absolute right-4 top-4 h-20 w-20 text-indigo-500 opacity-5" />
        <div className="relative"><h2 className="font-extrabold text-gray-800">習慣シナジーはまだ自動断定しません</h2><p className="mt-2 text-xs leading-relaxed text-gray-500">Phase 7では候補を小さく試す検証ループまで開放しましたが、「運動したから仕事が良くなった」のような習慣間の因果はまだ別扱いです。同日内の順序・反復・交絡条件を扱える設計が整うまでは自動断定しません。</p></div>
      </section>

      {setupCandidate && (
        <ExperimentSetupModal
          candidate={setupCandidate}
          dateKey={selectedDate}
          days={days}
          onStart={onStartExperiment}
          onClose={() => setSetupCandidate(null)}
        />
      )}
    </div>
  );
}

function CandidateCard({ candidate, experimentActive, onExperiment }) {
  const experimentable = canCreateExperiment(candidate);
  return (
    <article className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${EVIDENCE_STYLE[candidate.evidence]}`}>{candidate.evidenceLabel}</span><h3 className="mt-2 break-words text-base font-extrabold leading-snug text-gray-800">{candidate.title}</h3></div>
        <div className="shrink-0 text-right"><div className="text-[10px] font-bold text-gray-400">観測</div><div className="text-lg font-black text-indigo-600">{candidate.sampleCount}</div><div className="text-[9px] text-gray-400">{candidate.monthCount}か月</div></div>
      </div>
      <div className="mt-4 space-y-3">
        <EvidenceBlock label="観測事実" text={candidate.observation} />
        <EvidenceBlock label="差と不確実性" text={candidate.comparison} />
        <EvidenceBlock label="仮説" text={candidate.hypothesis} emphasis />
      </div>
      {experimentable && <button type="button" disabled={experimentActive} onClick={onExperiment} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white disabled:bg-gray-300"><FlaskConical className="h-4 w-4" />{experimentActive ? 'この候補を実験中' : 'この候補を小さく試す'}</button>}
      <p className="mt-4 border-t border-gray-100 pt-3 text-[10px] leading-relaxed text-gray-400">{candidate.caution}</p>
    </article>
  );
}
function EvidenceBlock({ label, text, emphasis = false }) { return <div className={`rounded-2xl p-3 ${emphasis ? 'bg-indigo-50' : 'bg-gray-50'}`}><div className={`text-[10px] font-black ${emphasis ? 'text-indigo-500' : 'text-gray-400'}`}>{label}</div><p className={`mt-1 text-xs leading-relaxed ${emphasis ? 'font-medium text-indigo-800' : 'text-gray-600'}`}>{text}</p></div>; }
function ReadinessMetric({ label, value, detail }) { return <div className="rounded-2xl bg-gray-50 p-3"><div className="text-[10px] font-bold text-gray-400">{label}</div><div className="mt-1 text-xl font-black text-gray-800">{value}</div><div className="mt-1 text-[9px] leading-relaxed text-gray-400">{detail}</div></div>; }
function Rule({ Icon, children }) { return <div className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" /><p>{children}</p></div>; }
