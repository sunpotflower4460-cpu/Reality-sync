import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Settings } from 'lucide-react';
import { STATUS, TABS } from './constants.js';
import { calculateMonthlyInsights, calculateWeeklyInsights } from './utils/analytics.js';
import { dateKeyFromDate, shiftDateKey } from './utils/date.js';
import { calculateLongitudinalInsights } from './utils/insights.js';
import { applyPlanFeedback, buildPlanFeedbackSuggestions } from './utils/planningFeedback.js';
import { calculateStats, createPendingScheduleCopy } from './utils/schedule.js';
import { applyWeeklyPlanFeedback, buildWeeklyPlanFeedback } from './utils/weeklyPlanningFeedback.js';
import { useDueRecordReminders } from './hooks/useDueRecordReminders.js';
import { useExperiments } from './hooks/useExperiments.js';
import { usePersistentSchedules } from './hooks/usePersistentSchedules.js';
import { usePwaInstall } from './hooks/usePwaInstall.js';
import { useReminderPreferences } from './hooks/useReminderPreferences.js';
import { useScheduleTemplates } from './hooks/useScheduleTemplates.js';
import { AnalyticsView } from './components/AnalyticsView.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { DateNavigator } from './components/DateNavigator.jsx';
import { PlanFeedbackModal } from './components/PlanFeedbackModal.jsx';
import { PlanView } from './components/PlanView.jsx';
import { RecordModal } from './components/RecordModal.jsx';
import { ScheduleEditorModal } from './components/ScheduleEditorModal.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { TemplateModal } from './components/TemplateModal.jsx';
import { TrackView } from './components/TrackView.jsx';
import { WeeklyPlanFeedbackModal } from './components/WeeklyPlanFeedbackModal.jsx';

function createScheduleId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function instantiatePlans(source) { return source.map((schedule) => createPendingScheduleCopy(schedule, createScheduleId())); }
function emptyWeeklyPlan(anchorDateKey) { return { anchorDateKey, dateKeys: [], suggestions: [], actionableCount: 0, guidanceCount: 0, multipleTargetGroups: [] }; }

export default function App() {
  const [activeTab, setActiveTab] = useState(TABS.TRACK);
  const [selectedDate, setSelectedDate] = useState(() => dateKeyFromDate());
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [selectedPlanFeedbackId, setSelectedPlanFeedbackId] = useState(null);
  const [isWeeklyPlanOpen, setIsWeeklyPlanOpen] = useState(false);
  const [editorState, setEditorState] = useState(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { schedules, setSchedules, store, replaceStore, storageProtection } = usePersistentSchedules(selectedDate);
  const { templates, saveTemplate, deleteTemplate, replaceTemplates } = useScheduleTemplates();
  const { experiments, startExperiment, captureTrial, removeTrial, finish, abandon, deleteExperiment, replaceExperiments } = useExperiments();
  const { preferences: reminderPreferences, setPreferences: setReminderPreferences, replacePreferences: replaceReminderPreferences } = useReminderPreferences();
  const { canInstall, isInstalled, install } = usePwaInstall();
  const dueSchedules = useDueRecordReminders({ schedules, dateKey: selectedDate, preferences: reminderPreferences });
  const stats = useMemo(() => calculateStats(schedules), [schedules]);
  const weeklyInsights = useMemo(() => calculateWeeklyInsights(store.days, selectedDate), [selectedDate, store.days]);
  const monthlyInsights = useMemo(() => calculateMonthlyInsights(store.days, selectedDate), [selectedDate, store.days]);
  const longitudinalInsights = useMemo(() => calculateLongitudinalInsights(store.days, selectedDate), [selectedDate, store.days]);
  const todayKey = dateKeyFromDate();
  const planFeedbackSuggestions = useMemo(
    () => selectedDate >= todayKey ? buildPlanFeedbackSuggestions(experiments, selectedDate, schedules) : [],
    [experiments, schedules, selectedDate, todayKey],
  );
  const weeklyPlanFeedback = useMemo(
    () => selectedDate >= todayKey ? buildWeeklyPlanFeedback(experiments, store.days, selectedDate, todayKey) : emptyWeeklyPlan(selectedDate),
    [experiments, selectedDate, store.days, todayKey],
  );
  const selectedPlanFeedback = useMemo(
    () => planFeedbackSuggestions.find((suggestion) => suggestion.id === selectedPlanFeedbackId) ?? null,
    [planFeedbackSuggestions, selectedPlanFeedbackId],
  );
  const previousDate = useMemo(() => shiftDateKey(selectedDate, -1), [selectedDate]);
  const previousSchedules = store.days[previousDate] ?? [];
  const protectedMode = storageProtection.persistenceBlocked;

  const selectedSchedule = useMemo(() => schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null, [schedules, selectedScheduleId]);
  const editingSchedule = useMemo(() => editorState?.type === 'edit' ? schedules.find((schedule) => schedule.id === editorState.id) ?? null : null, [editorState, schedules]);

  const changeDate = (dateKey) => {
    setSelectedScheduleId(null);
    setSelectedPlanFeedbackId(null);
    setIsWeeklyPlanOpen(false);
    setEditorState(null);
    setIsTemplateModalOpen(false);
    setSelectedDate(dateKey);
  };
  const saveRecord = (record) => { if (selectedScheduleId === null || protectedMode) return; setSchedules((current) => current.map((schedule) => schedule.id === selectedScheduleId ? { ...schedule, ...record } : schedule)); setSelectedScheduleId(null); };
  const saveSchedule = (draft) => {
    if (protectedMode) return;
    if (editorState?.type === 'edit') setSchedules((current) => current.map((schedule) => schedule.id === editorState.id ? { ...schedule, ...draft } : schedule));
    else setSchedules((current) => [...current, { id: createScheduleId(), ...draft, appliedExperimentIds: [], status: STATUS.PENDING, plannedSnapshot: null, actualTitle: '', actualCategory: null, actualDuration: null, actualStartTime: null, actualStartDateKey: null, deviationReason: null, mood: null, actualStress: null }]);
    setEditorState(null);
  };
  const deleteSchedule = (scheduleId) => { if (protectedMode) return; setSchedules((current) => current.filter((schedule) => schedule.id !== scheduleId)); if (selectedScheduleId === scheduleId) setSelectedScheduleId(null); setSelectedPlanFeedbackId(null); setEditorState(null); };
  const confirmReplaceDay = (sourceLabel) => {
    if (schedules.length === 0) return true;
    const hasReality = schedules.some((schedule) => schedule.status !== STATUS.PENDING);
    return window.confirm(`${sourceLabel}でこの日の予定を置き換えますか？\n${hasReality ? '現在の予定と、この日に記録済みの実績も削除されます。' : '現在の予定は削除されます。'}`);
  };
  const copyPreviousDay = () => { if (protectedMode || previousSchedules.length === 0 || !confirmReplaceDay('前日の予定')) return; setSchedules(instantiatePlans(previousSchedules)); setSelectedPlanFeedbackId(null); };
  const applyTemplate = (template) => { if (protectedMode || !template?.schedules?.length || !confirmReplaceDay(`テンプレート「${template.name}」`)) return; setSchedules(instantiatePlans(template.schedules)); setSelectedPlanFeedbackId(null); setIsTemplateModalOpen(false); };

  const applySelectedPlanFeedback = () => {
    if (protectedMode || !selectedPlanFeedback) return;
    const experiment = experiments.find((item) => item.id === selectedPlanFeedback.experimentId);
    if (!experiment) { setSelectedPlanFeedbackId(null); return; }
    const result = applyPlanFeedback(experiment, selectedDate, schedules, selectedPlanFeedback.scheduleId, createScheduleId());
    if (result.ok) setSchedules(result.schedules);
    setSelectedPlanFeedbackId(null);
  };

  const applySelectedWeeklyPlanFeedback = (selectedSuggestionIds) => {
    if (protectedMode) return;
    const result = applyWeeklyPlanFeedback(
      experiments,
      store.days,
      weeklyPlanFeedback,
      selectedSuggestionIds,
      () => createScheduleId(),
    );
    if (!result.ok) return;
    replaceStore({ ...store, days: result.days });
    setSelectedPlanFeedbackId(null);
    setIsWeeklyPlanOpen(false);
  };

  const restoreBackup = ({ scheduleStore, templates: restoredTemplates, reminderPreferences: restoredReminders, experiments: restoredExperiments = [] }) => {
    replaceStore(scheduleStore); replaceTemplates(restoredTemplates); replaceReminderPreferences(restoredReminders); replaceExperiments(restoredExperiments);
    setSelectedScheduleId(null); setSelectedPlanFeedbackId(null); setIsWeeklyPlanOpen(false); setEditorState(null); setIsTemplateModalOpen(false);
    const dayKeys = Object.keys(scheduleStore.days).sort();
    if (!(selectedDate in scheduleStore.days) && dayKeys.length > 0) setSelectedDate(dayKeys.at(-1));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 text-gray-800">
      <header className="sticky top-0 z-10 rounded-b-[2rem] bg-indigo-600 px-4 pb-5 pt-10 text-white shadow-md">
        <div className="mx-auto max-w-md">
          <div className="flex items-end justify-between gap-4">
            <div><h1 className="mb-1 text-3xl font-extrabold tracking-tight">RealitySync</h1><p className="text-sm font-medium text-indigo-200">理想と現実のギャップを力に変える</p></div>
            <div className="flex items-center gap-2">{activeTab === TABS.PLAN && !protectedMode && <button type="button" onClick={() => setEditorState({ type: 'create' })} aria-label="予定を追加" className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition hover:bg-white/30"><Plus className="h-5 w-5" /></button>}<button type="button" onClick={() => setIsSettingsOpen(true)} aria-label="設定とデータを開く" className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition hover:bg-white/30"><Settings className="h-5 w-5" /></button></div>
          </div>
          <DateNavigator dateKey={selectedDate} onChange={changeDate} />
        </div>
      </header>
      <main className="mx-auto -mt-2 max-w-md p-4">
        {protectedMode ? (
          <section className="mt-6 rounded-3xl border border-red-200 bg-white p-6 text-center shadow-sm"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500"><AlertTriangle className="h-6 w-6" /></div><h2 className="text-lg font-extrabold text-gray-800">保存データを保護しています</h2><p className="mt-2 text-sm leading-relaxed text-gray-500">現在版では保存済みデータを安全に解釈できないため、編集と自動保存を停止しました。元のlocalStorageは上書きしていません。</p>{storageProtection.unsupportedVersion !== null && <p className="mt-2 text-xs font-bold text-red-600">検出した保存版: {String(storageProtection.unsupportedVersion)}</p>}<button type="button" onClick={() => setIsSettingsOpen(true)} className="mt-5 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white">設定とデータを開く</button></section>
        ) : <>{activeTab === TABS.PLAN && <PlanView schedules={schedules} onCreate={() => setEditorState({ type: 'create' })} onEdit={(id) => setEditorState({ type: 'edit', id })} onCopyPrevious={copyPreviousDay} hasPreviousSchedules={previousSchedules.length > 0} onOpenTemplates={() => setIsTemplateModalOpen(true)} templateCount={templates.length} planFeedbackSuggestions={planFeedbackSuggestions} onReviewPlanFeedback={(suggestion) => setSelectedPlanFeedbackId(suggestion.id)} weeklyPlanFeedback={weeklyPlanFeedback} onOpenWeeklyPlan={() => setIsWeeklyPlanOpen(true)} />}{activeTab === TABS.TRACK && <TrackView schedules={schedules} dueSchedules={dueSchedules} dateKey={selectedDate} onRecord={(schedule) => setSelectedScheduleId(schedule.id)} />}{activeTab === TABS.ANALYTICS && <AnalyticsView stats={stats} weeklyInsights={weeklyInsights} monthlyInsights={monthlyInsights} longitudinalInsights={longitudinalInsights} experiments={experiments} days={store.days} selectedDate={selectedDate} onChangeDate={changeDate} onStartExperiment={startExperiment} onCaptureTrial={captureTrial} onRemoveTrial={removeTrial} onFinishExperiment={finish} onAbandonExperiment={abandon} onDeleteExperiment={deleteExperiment} />}</>}
      </main>
      {!protectedMode && <BottomNav activeTab={activeTab} onChange={setActiveTab} />}
      {!protectedMode && selectedSchedule && <RecordModal schedule={selectedSchedule} dateKey={selectedDate} onClose={() => setSelectedScheduleId(null)} onSave={saveRecord} />}
      {!protectedMode && selectedPlanFeedback && <PlanFeedbackModal preview={selectedPlanFeedback.preview} onApply={applySelectedPlanFeedback} onClose={() => setSelectedPlanFeedbackId(null)} />}
      {!protectedMode && isWeeklyPlanOpen && <WeeklyPlanFeedbackModal weeklyPlan={weeklyPlanFeedback} experiments={experiments} days={store.days} onApply={applySelectedWeeklyPlanFeedback} onClose={() => setIsWeeklyPlanOpen(false)} />}
      {!protectedMode && editorState && (editorState.type !== 'edit' || editingSchedule) && <ScheduleEditorModal schedule={editingSchedule} onClose={() => setEditorState(null)} onSave={saveSchedule} onDelete={editorState.type === 'edit' ? deleteSchedule : undefined} />}
      {!protectedMode && isTemplateModalOpen && <TemplateModal templates={templates} currentSchedules={schedules} onClose={() => setIsTemplateModalOpen(false)} onSaveTemplate={(name) => saveTemplate(name, schedules)} onApplyTemplate={applyTemplate} onDeleteTemplate={deleteTemplate} />}
      {isSettingsOpen && <SettingsModal store={store} templates={templates} experiments={experiments} reminderPreferences={reminderPreferences} storageProtection={storageProtection} onChangeReminderPreferences={setReminderPreferences} onRestoreBackup={restoreBackup} canInstall={canInstall} isInstalled={isInstalled} onInstall={install} onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}
