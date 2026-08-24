import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Settings } from 'lucide-react';
import {
  EXPERIMENT_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  REMINDER_NOTIFIED_STORAGE_KEY,
  REMINDER_STORAGE_KEY,
  STATUS,
  STORAGE_KEY,
  TEMPLATE_STORAGE_KEY,
  TABS,
} from './constants.js';
import { calculateMonthlyInsights, calculateWeeklyInsights } from './utils/analytics.js';
import { dateKeyFromDate, shiftDateKey } from './utils/date.js';
import { calculateLongitudinalInsights } from './utils/insights.js';
import { applyPlanFeedback, buildPlanFeedbackSuggestions } from './utils/planningFeedback.js';
import { DEFAULT_REMINDER_PREFERENCES } from './utils/reminder.js';
import { calculateStats, createPendingScheduleCopy } from './utils/schedule.js';
import { createEmptyScheduleStore } from './utils/storage.js';
import { useDueRecordReminders } from './hooks/useDueRecordReminders.js';
import { useExperiments } from './hooks/useExperiments.js';
import { usePersistentSchedules } from './hooks/usePersistentSchedules.js';
import { usePwaInstall } from './hooks/usePwaInstall.js';
import { useReminderPreferences } from './hooks/useReminderPreferences.js';
import { useScheduleTemplates } from './hooks/useScheduleTemplates.js';
import { AnalyticsView } from './components/AnalyticsView.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { DateNavigator } from './components/DateNavigator.jsx';
import { LegalModal } from './components/LegalModal.jsx';
import { PlanFeedbackModal } from './components/PlanFeedbackModal.jsx';
import { PlanView } from './components/PlanView.jsx';
import { RecordModal } from './components/RecordModal.jsx';
import { ScheduleEditorModal } from './components/ScheduleEditorModal.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { TemplateModal } from './components/TemplateModal.jsx';
import { TrackView } from './components/TrackView.jsx';

function createScheduleId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function instantiatePlans(source) { return source.map((schedule) => createPendingScheduleCopy(schedule, createScheduleId())); }

const LOCAL_STORAGE_KEYS = Object.freeze([
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  TEMPLATE_STORAGE_KEY,
  REMINDER_STORAGE_KEY,
  REMINDER_NOTIFIED_STORAGE_KEY,
  EXPERIMENT_STORAGE_KEY,
]);

export default function App() {
  const [activeTab, setActiveTab] = useState(TABS.TRACK);
  const [selectedDate, setSelectedDate] = useState(() => dateKeyFromDate());
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [selectedPlanFeedbackId, setSelectedPlanFeedbackId] = useState(null);
  const [editorState, setEditorState] = useState(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [legalPage, setLegalPage] = useState(null);
  const { schedules, setSchedules, store, replaceStore, storageProtection } = usePersistentSchedules(selectedDate);
  const { templates, saveTemplate, deleteTemplate, replaceTemplates } = useScheduleTemplates();
  const { experiments, replaceExperiments } = useExperiments();
  const { preferences: reminderPreferences, setPreferences: setReminderPreferences, replacePreferences: replaceReminderPreferences } = useReminderPreferences();
  const { canInstall, isInstalled, install } = usePwaInstall();
  const dueSchedules = useDueRecordReminders({ schedules, dateKey: selectedDate, preferences: reminderPreferences });
  const stats = useMemo(() => calculateStats(schedules), [schedules]);
  const weeklyInsights = useMemo(() => calculateWeeklyInsights(store.days, selectedDate), [selectedDate, store.days]);
  const monthlyInsights = useMemo(() => calculateMonthlyInsights(store.days, selectedDate), [selectedDate, store.days]);
  const longitudinalInsights = useMemo(() => calculateLongitudinalInsights(store.days, selectedDate), [selectedDate, store.days]);
  const todayKey = dateKeyFromDate();
  const isNativeShell = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const planFeedbackSuggestions = useMemo(
    () => selectedDate >= todayKey ? buildPlanFeedbackSuggestions(experiments, selectedDate, schedules) : [],
    [experiments, schedules, selectedDate, todayKey],
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
    setEditorState(null);
    setIsTemplateModalOpen(false);
    setSelectedDate(dateKey);
  };

  const saveRecord = (record) => {
    if (selectedScheduleId === null || protectedMode) return;
    setSchedules((current) => current.map((schedule) => schedule.id === selectedScheduleId ? { ...schedule, ...record } : schedule));
    setSelectedScheduleId(null);
  };

  const saveSchedule = (draft) => {
    if (protectedMode) return;
    if (editorState?.type === 'edit') {
      setSchedules((current) => current.map((schedule) => schedule.id === editorState.id ? { ...schedule, ...draft } : schedule));
    } else {
      setSchedules((current) => [...current, {
        id: createScheduleId(),
        ...draft,
        appliedExperimentIds: [],
        status: STATUS.PENDING,
        plannedSnapshot: null,
        actualTitle: '',
        actualCategory: null,
        actualDuration: null,
        actualStartTime: null,
        actualStartDateKey: null,
        deviationReason: null,
        mood: null,
        actualStress: null,
      }]);
    }
    setEditorState(null);
  };

  const deleteSchedule = (scheduleId) => {
    if (protectedMode) return;
    setSchedules((current) => current.filter((schedule) => schedule.id !== scheduleId));
    if (selectedScheduleId === scheduleId) setSelectedScheduleId(null);
    setSelectedPlanFeedbackId(null);
    setEditorState(null);
  };

  const confirmReplaceDay = (sourceLabel) => {
    if (schedules.length === 0) return true;
    const hasReality = schedules.some((schedule) => schedule.status !== STATUS.PENDING);
    return window.confirm(`${sourceLabel}でこの日の予定を置き換えますか？\n${hasReality ? '現在の予定と、この日に記録済みの実績も削除されます。' : '現在の予定は削除されます。'}`);
  };

  const copyPreviousDay = () => {
    if (protectedMode || previousSchedules.length === 0 || !confirmReplaceDay('前日の予定')) return;
    setSchedules(instantiatePlans(previousSchedules));
    setSelectedPlanFeedbackId(null);
  };

  const applyTemplate = (template) => {
    if (protectedMode || !template?.schedules?.length || !confirmReplaceDay(`テンプレート「${template.name}」`)) return;
    setSchedules(instantiatePlans(template.schedules));
    setSelectedPlanFeedbackId(null);
    setIsTemplateModalOpen(false);
  };

  const applySelectedPlanFeedback = () => {
    if (protectedMode || !selectedPlanFeedback) return;
    const experiment = experiments.find((item) => item.id === selectedPlanFeedback.experimentId);
    if (!experiment) {
      setSelectedPlanFeedbackId(null);
      return;
    }
    const result = applyPlanFeedback(experiment, selectedDate, schedules, selectedPlanFeedback.scheduleId, createScheduleId());
    if (result.ok) setSchedules(result.schedules);
    setSelectedPlanFeedbackId(null);
  };

  const restoreBackup = ({ scheduleStore, templates: restoredTemplates, reminderPreferences: restoredReminders, experiments: restoredExperiments = [] }) => {
    replaceStore(scheduleStore);
    replaceTemplates(restoredTemplates);
    replaceReminderPreferences(restoredReminders);
    replaceExperiments(restoredExperiments);
    setSelectedScheduleId(null);
    setSelectedPlanFeedbackId(null);
    setEditorState(null);
    setIsTemplateModalOpen(false);
    const dayKeys = Object.keys(scheduleStore.days).sort();
    if (!(selectedDate in scheduleStore.days) && dayKeys.length > 0) setSelectedDate(dayKeys.at(-1));
  };

  const eraseAllData = () => {
    const today = dateKeyFromDate();
    replaceStore(createEmptyScheduleStore());
    replaceTemplates([]);
    replaceExperiments([]);
    replaceReminderPreferences(DEFAULT_REMINDER_PREFERENCES);
    try {
      for (const key of LOCAL_STORAGE_KEYS) window.localStorage.removeItem(key);
    } catch {
      // React state is still cleared even when the storage API is unavailable.
    }
    setSelectedDate(today);
    setSelectedScheduleId(null);
    setSelectedPlanFeedbackId(null);
    setEditorState(null);
    setIsTemplateModalOpen(false);
    setActiveTab(TABS.TRACK);
  };

  const openLegal = (page) => {
    setIsSettingsOpen(false);
    setLegalPage(page);
  };

  return (
    <div className="min-h-dvh bg-transparent pb-28 text-slate-800">
      <header className="sticky top-0 z-10 rounded-b-[2rem] bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-4 pb-4 pt-app-safe text-white shadow-[0_14px_38px_rgba(79,70,229,0.24)]">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[1.55rem] font-black tracking-[-0.035em]">RealitySync</h1>
              <p className="mt-0.5 text-[11px] font-semibold tracking-wide text-indigo-100/90">理想と現実のギャップを、次の予定へ</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {activeTab === TABS.PLAN && !protectedMode && (
                <button type="button" onClick={() => setEditorState({ type: 'create' })} aria-label="予定を追加" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/12 text-white shadow-sm backdrop-blur-sm transition hover:bg-white/20 active:scale-[0.97]">
                  <Plus className="h-5 w-5" />
                </button>
              )}
              <button type="button" onClick={() => setIsSettingsOpen(true)} aria-label="設定とデータを開く" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/12 text-white shadow-sm backdrop-blur-sm transition hover:bg-white/20 active:scale-[0.97]">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
          <DateNavigator dateKey={selectedDate} onChange={changeDate} />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-4">
        {protectedMode ? (
          <section className="app-card mt-5 rounded-[1.6rem] border-red-200 p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500"><AlertTriangle className="h-6 w-6" /></div>
            <h2 className="text-lg font-black text-slate-800">保存データを保護しています</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">現在版では保存済みデータを安全に解釈できないため、編集と自動保存を停止しました。元データは上書きしていません。</p>
            {storageProtection.unsupportedVersion !== null && <p className="mt-2 text-xs font-bold text-red-600">検出した保存版: {String(storageProtection.unsupportedVersion)}</p>}
            <button type="button" onClick={() => setIsSettingsOpen(true)} className="mt-5 min-h-12 w-full rounded-2xl bg-indigo-600 px-4 text-sm font-extrabold text-white">設定とデータを開く</button>
          </section>
        ) : (
          <>
            {activeTab === TABS.PLAN && <PlanView schedules={schedules} onCreate={() => setEditorState({ type: 'create' })} onEdit={(id) => setEditorState({ type: 'edit', id })} onCopyPrevious={copyPreviousDay} hasPreviousSchedules={previousSchedules.length > 0} onOpenTemplates={() => setIsTemplateModalOpen(true)} templateCount={templates.length} planFeedbackSuggestions={planFeedbackSuggestions} onReviewPlanFeedback={(suggestion) => setSelectedPlanFeedbackId(suggestion.id)} />}
            {activeTab === TABS.TRACK && <TrackView schedules={schedules} dueSchedules={dueSchedules} dateKey={selectedDate} onRecord={(schedule) => setSelectedScheduleId(schedule.id)} />}
            {activeTab === TABS.ANALYTICS && <AnalyticsView stats={stats} weeklyInsights={weeklyInsights} monthlyInsights={monthlyInsights} longitudinalInsights={longitudinalInsights} selectedDate={selectedDate} onChangeDate={changeDate} />}
          </>
        )}
      </main>

      {!protectedMode && <BottomNav activeTab={activeTab} onChange={setActiveTab} />}
      {!protectedMode && selectedSchedule && <RecordModal schedule={selectedSchedule} dateKey={selectedDate} onClose={() => setSelectedScheduleId(null)} onSave={saveRecord} />}
      {!protectedMode && selectedPlanFeedback && <PlanFeedbackModal preview={selectedPlanFeedback.preview} onApply={applySelectedPlanFeedback} onClose={() => setSelectedPlanFeedbackId(null)} />}
      {!protectedMode && editorState && (editorState.type !== 'edit' || editingSchedule) && <ScheduleEditorModal schedule={editingSchedule} onClose={() => setEditorState(null)} onSave={saveSchedule} onDelete={editorState.type === 'edit' ? deleteSchedule : undefined} />}
      {!protectedMode && isTemplateModalOpen && <TemplateModal templates={templates} currentSchedules={schedules} onClose={() => setIsTemplateModalOpen(false)} onSaveTemplate={(name) => saveTemplate(name, schedules)} onApplyTemplate={applyTemplate} onDeleteTemplate={deleteTemplate} />}
      {isSettingsOpen && <SettingsModal store={store} templates={templates} experiments={experiments} reminderPreferences={reminderPreferences} storageProtection={storageProtection} onChangeReminderPreferences={setReminderPreferences} onRestoreBackup={restoreBackup} onEraseAllData={eraseAllData} onOpenLegal={openLegal} canInstall={canInstall} isInstalled={isInstalled} isNativeShell={isNativeShell} onInstall={install} onClose={() => setIsSettingsOpen(false)} />}
      {legalPage && <LegalModal page={legalPage} onClose={() => setLegalPage(null)} />}
    </div>
  );
}
