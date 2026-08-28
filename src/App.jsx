import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Plus, Settings } from 'lucide-react';
import { STATUS, TABS } from './constants.js';
import { calculateMonthlyInsights, calculateWeeklyInsights } from './utils/analytics.js';
import { dateKeyFromDate, shiftDateKey } from './utils/date.js';
import { createUniqueId } from './utils/id.js';
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

function instantiatePlans(source) {
  const ids = [];
  return source.map((schedule) => {
    const id = createUniqueId('schedule', ids);
    ids.push(id);
    return createPendingScheduleCopy(schedule, id);
  });
}
function scheduleRevisionKey(schedule) { return schedule ? JSON.stringify(schedule) : 'none'; }
function dayRevisionKey(schedules) { return JSON.stringify(Array.isArray(schedules) ? schedules : []); }
function timeKeyFromDate(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState(TABS.TRACK);
  const [selectedDate, setSelectedDate] = useState(() => dateKeyFromDate());
  const [recordSession, setRecordSession] = useState(null);
  const [selectedPlanFeedbackId, setSelectedPlanFeedbackId] = useState(null);
  const [editorState, setEditorState] = useState(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [legalPage, setLegalPage] = useState(null);
  const {
    schedules,
    setSchedules,
    store,
    replaceStore,
    storageProtection: scheduleStorageProtection,
  } = usePersistentSchedules(selectedDate);
  const {
    templates,
    saveTemplate,
    deleteTemplate,
    replaceTemplates,
    storageProtection: templateStorageProtection,
  } = useScheduleTemplates();
  const {
    experiments,
    replaceExperiments,
    storageProtection: experimentStorageProtection,
  } = useExperiments();
  const {
    preferences: reminderPreferences,
    setPreferences: setReminderPreferences,
    replacePreferences: replaceReminderPreferences,
    storageProtection: reminderStorageProtection,
  } = useReminderPreferences();
  const { canInstall, isInstalled, install } = usePwaInstall();
  const observationNow = new Date();
  const todayKey = dateKeyFromDate(observationNow);
  const observationTime = timeKeyFromDate(observationNow);
  const dueSchedules = useDueRecordReminders({ schedules, dateKey: selectedDate, scheduleDays: store.days, preferences: reminderPreferences });
  const observedDailySchedules = useMemo(() => (
    selectedDate === todayKey
      ? schedules.filter((schedule) => schedule.status !== STATUS.PENDING || schedule.time <= observationTime)
      : schedules
  ), [observationTime, schedules, selectedDate, todayKey]);
  const stats = useMemo(() => calculateStats(observedDailySchedules), [observedDailySchedules]);
  const weeklyInsights = useMemo(
    () => calculateWeeklyInsights(store.days, selectedDate, todayKey, observationTime),
    [observationTime, selectedDate, store.days, todayKey],
  );
  const monthlyInsights = useMemo(
    () => calculateMonthlyInsights(store.days, selectedDate, todayKey, observationTime),
    [observationTime, selectedDate, store.days, todayKey],
  );
  const longitudinalInsights = useMemo(() => calculateLongitudinalInsights(store.days, selectedDate), [selectedDate, store.days]);
  const previousTodayKeyRef = useRef(todayKey);
  const canRecordSelectedDate = selectedDate <= todayKey;
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
  const storageProtection = useMemo(() => {
    const protectedDomains = [];
    const writeFailedDomains = [];
    const conflictDomains = [];
    if (scheduleStorageProtection.persistenceBlocked) protectedDomains.push('予定・実績');
    if (templateStorageProtection.persistenceBlocked) protectedDomains.push('テンプレート');
    if (experimentStorageProtection.persistenceBlocked) protectedDomains.push('実験履歴');
    if (reminderStorageProtection.persistenceBlocked) protectedDomains.push('リマインダー設定');
    if (scheduleStorageProtection.writeFailed) writeFailedDomains.push('予定・実績');
    if (templateStorageProtection.writeFailed) writeFailedDomains.push('テンプレート');
    if (experimentStorageProtection.writeFailed) writeFailedDomains.push('実験履歴');
    if (reminderStorageProtection.writeFailed) writeFailedDomains.push('リマインダー設定');
    if (scheduleStorageProtection.writeConflict) conflictDomains.push('予定・実績');
    if (templateStorageProtection.writeConflict) conflictDomains.push('テンプレート');
    if (experimentStorageProtection.writeConflict) conflictDomains.push('実験履歴');
    if (reminderStorageProtection.writeConflict) conflictDomains.push('リマインダー設定');
    return {
      persistenceBlocked: protectedDomains.length > 0,
      writeFailed: writeFailedDomains.length > 0,
      writeConflict: conflictDomains.length > 0,
      unsupportedVersion: scheduleStorageProtection.unsupportedVersion ?? experimentStorageProtection.unsupportedVersion,
      protectedDomains,
      writeFailedDomains,
      conflictDomains,
      conflictDateKeys: scheduleStorageProtection.conflictDateKeys ?? [],
    };
  }, [
    experimentStorageProtection.persistenceBlocked,
    experimentStorageProtection.unsupportedVersion,
    experimentStorageProtection.writeConflict,
    experimentStorageProtection.writeFailed,
    reminderStorageProtection.persistenceBlocked,
    reminderStorageProtection.writeConflict,
    reminderStorageProtection.writeFailed,
    scheduleStorageProtection.conflictDateKeys,
    scheduleStorageProtection.persistenceBlocked,
    scheduleStorageProtection.unsupportedVersion,
    scheduleStorageProtection.writeConflict,
    scheduleStorageProtection.writeFailed,
    templateStorageProtection.persistenceBlocked,
    templateStorageProtection.writeConflict,
    templateStorageProtection.writeFailed,
  ]);
  const protectedMode = storageProtection.persistenceBlocked || storageProtection.writeConflict;

  const currentRecordSchedule = useMemo(() => (
    recordSession ? schedules.find((schedule) => schedule.id === recordSession.id) ?? null : null
  ), [recordSession, schedules]);
  const recordSessionStale = Boolean(recordSession && (
    !currentRecordSchedule || scheduleRevisionKey(currentRecordSchedule) !== recordSession.baseRevision
  ));
  const currentEditingSchedule = useMemo(() => (
    editorState?.type === 'edit'
      ? schedules.find((schedule) => schedule.id === editorState.id) ?? null
      : null
  ), [editorState, schedules]);
  const editorSessionStale = Boolean(editorState?.type === 'edit' && (
    !currentEditingSchedule || scheduleRevisionKey(currentEditingSchedule) !== editorState.baseRevision
  ));
  const editingSchedule = editorState?.type === 'edit' ? editorState.schedule : null;

  useEffect(() => {
    const previousTodayKey = previousTodayKeyRef.current;
    if (previousTodayKey === todayKey) return;
    previousTodayKeyRef.current = todayKey;
    if (selectedDate !== previousTodayKey) return;
    setRecordSession(null);
    setSelectedPlanFeedbackId(null);
    setEditorState(null);
    setIsTemplateModalOpen(false);
    setSelectedDate(todayKey);
  }, [selectedDate, todayKey]);

  const changeDate = (dateKey) => {
    setRecordSession(null);
    setSelectedPlanFeedbackId(null);
    setEditorState(null);
    setIsTemplateModalOpen(false);
    setSelectedDate(dateKey);
  };

  const openRecord = (schedule) => {
    if (!schedule || protectedMode || !canRecordSelectedDate) return;
    setRecordSession({
      id: schedule.id,
      dateKey: selectedDate,
      baseRevision: scheduleRevisionKey(schedule),
      schedule,
    });
  };

  const openScheduleEditor = (scheduleId) => {
    if (protectedMode) return;
    const schedule = schedules.find((item) => item.id === scheduleId);
    if (!schedule) return;
    setEditorState({
      type: 'edit',
      id: schedule.id,
      baseRevision: scheduleRevisionKey(schedule),
      schedule,
    });
  };

  const saveRecord = (record) => {
    if (!recordSession || protectedMode || !canRecordSelectedDate || recordSession.dateKey !== selectedDate) return false;
    const accepted = setSchedules((current) => {
      const currentSchedule = current.find((schedule) => schedule.id === recordSession.id);
      if (!currentSchedule || scheduleRevisionKey(currentSchedule) !== recordSession.baseRevision) return null;
      return current.map((schedule) => schedule.id === recordSession.id ? { ...schedule, ...record } : schedule);
    });
    if (!accepted) return false;
    setRecordSession(null);
    return true;
  };

  const saveSchedule = (draft) => {
    if (protectedMode) return false;
    let accepted;
    if (editorState?.type === 'edit') {
      accepted = setSchedules((current) => {
        const currentSchedule = current.find((schedule) => schedule.id === editorState.id);
        if (!currentSchedule || scheduleRevisionKey(currentSchedule) !== editorState.baseRevision) return null;
        return current.map((schedule) => schedule.id === editorState.id ? { ...schedule, ...draft } : schedule);
      });
    } else {
      accepted = setSchedules((current) => {
        const id = createUniqueId('schedule', current.map((schedule) => schedule.id));
        return [...current, {
          id,
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
        }];
      });
    }
    if (!accepted) return false;
    setEditorState(null);
    return true;
  };

  const deleteSchedule = (scheduleId) => {
    if (protectedMode) return false;
    const accepted = setSchedules((current) => {
      if (editorState?.type === 'edit' && editorState.id === scheduleId) {
        const currentSchedule = current.find((schedule) => schedule.id === scheduleId);
        if (!currentSchedule || scheduleRevisionKey(currentSchedule) !== editorState.baseRevision) return null;
      }
      if (!current.some((schedule) => schedule.id === scheduleId)) return null;
      return current.filter((schedule) => schedule.id !== scheduleId);
    });
    if (!accepted) return false;
    if (recordSession?.id === scheduleId) setRecordSession(null);
    setSelectedPlanFeedbackId(null);
    setEditorState(null);
    return true;
  };

  const confirmReplaceDay = (sourceLabel) => {
    if (schedules.length === 0) return true;
    const hasReality = schedules.some((schedule) => schedule.status !== STATUS.PENDING);
    return window.confirm(`${sourceLabel}でこの日の予定を置き換えますか？\n${hasReality ? '現在の予定と、この日に記録済みの実績も削除されます。' : '現在の予定は削除されます。'}`);
  };

  const copyPreviousDay = () => {
    if (protectedMode || previousSchedules.length === 0) return;
    const targetRevision = dayRevisionKey(schedules);
    const sourceRevision = dayRevisionKey(previousSchedules);
    if (!confirmReplaceDay('前日の予定')) return;
    const accepted = setSchedules((current, latestStore) => {
      const latestSource = latestStore.days[previousDate] ?? [];
      if (dayRevisionKey(current) !== targetRevision) return null;
      if (dayRevisionKey(latestSource) !== sourceRevision || latestSource.length === 0) return null;
      return instantiatePlans(latestSource);
    });
    if (!accepted) return;
    setSelectedPlanFeedbackId(null);
  };

  const applyTemplate = (template) => {
    if (protectedMode || !template?.schedules?.length) return false;
    const baseRevision = dayRevisionKey(schedules);
    if (!confirmReplaceDay(`テンプレート「${template.name}」`)) return false;
    const accepted = setSchedules((current) => (
      dayRevisionKey(current) === baseRevision ? instantiatePlans(template.schedules) : null
    ));
    if (!accepted) return false;
    setSelectedPlanFeedbackId(null);
    setIsTemplateModalOpen(false);
    return true;
  };

  const applySelectedPlanFeedback = () => {
    if (protectedMode || !selectedPlanFeedback) return false;
    const experiment = experiments.find((item) => item.id === selectedPlanFeedback.experimentId);
    if (!experiment) {
      setSelectedPlanFeedbackId(null);
      return false;
    }
    const accepted = setSchedules((current) => {
      const newScheduleId = createUniqueId('schedule', current.map((schedule) => schedule.id));
      const result = applyPlanFeedback(
        experiment,
        selectedDate,
        current,
        selectedPlanFeedback.scheduleId,
        newScheduleId,
      );
      return result.ok ? result.schedules : null;
    });
    if (!accepted) return false;
    setSelectedPlanFeedbackId(null);
    return true;
  };

  const restoreBackup = ({ scheduleStore, templates: restoredTemplates, reminderPreferences: restoredReminders, experiments: restoredExperiments = [] }) => {
    replaceStore(scheduleStore);
    replaceTemplates(restoredTemplates);
    replaceReminderPreferences(restoredReminders);
    replaceExperiments(restoredExperiments);
    setRecordSession(null);
    setSelectedPlanFeedbackId(null);
    setEditorState(null);
    setIsTemplateModalOpen(false);
    const dayKeys = Object.keys(scheduleStore.days).sort();
    if (dayKeys.length === 0) setSelectedDate(dateKeyFromDate());
    else if (!(selectedDate in scheduleStore.days)) setSelectedDate(dayKeys.at(-1));
  };

  const eraseAllData = () => {
    const today = dateKeyFromDate();
    replaceStore(createEmptyScheduleStore());
    replaceTemplates([]);
    replaceExperiments([]);
    replaceReminderPreferences(DEFAULT_REMINDER_PREFERENCES);
    setSelectedDate(today);
    setRecordSession(null);
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
    <div className="min-h-dvh bg-[#f6f7fb] text-slate-800">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/90 px-4 pb-2 pt-app-safe shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur-2xl">
        <div className="mx-auto max-w-md">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 shadow-[0_0_0_4px_rgba(99,102,241,0.08)]" aria-hidden="true" />
              <h1 className="truncate text-[15px] font-semibold tracking-[-0.025em] text-slate-900">RealitySync</h1>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {activeTab === TABS.PLAN && !protectedMode && (
                <button type="button" onClick={() => setEditorState({ type: 'create' })} aria-label="予定を追加" className="tap-target flex items-center justify-center rounded-xl text-indigo-600 transition hover:bg-indigo-50 active:bg-indigo-100">
                  <Plus className="h-[1.15rem] w-[1.15rem]" />
                </button>
              )}
              <button type="button" onClick={() => setIsSettingsOpen(true)} aria-label="設定とデータを開く" className="tap-target flex items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 active:bg-slate-200/80">
                <Settings className="h-[1.1rem] w-[1.1rem]" />
              </button>
            </div>
          </div>
          <DateNavigator dateKey={selectedDate} onChange={changeDate} />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
        {storageProtection.writeFailed && (
          <section role="alert" className="mt-4 rounded-[1.1rem] border border-amber-200 bg-amber-50 p-3.5 text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h2 className="text-[11px] font-semibold">端末への保存に失敗しています</h2>
                <p className="mt-1 text-[9px] leading-relaxed text-amber-800">画面上の変更は残っていますが、再読み込みすると失われる可能性があります。設定とデータからバックアップを書き出してください。</p>
                <p className="mt-1 text-[8px] font-medium text-amber-700">保存失敗: {storageProtection.writeFailedDomains.join('・')}</p>
                <button type="button" onClick={() => setIsSettingsOpen(true)} className="mt-2 min-h-9 rounded-lg bg-white px-3 text-[9px] font-semibold text-amber-800 ring-1 ring-amber-200">設定とデータを開く</button>
              </div>
            </div>
          </section>
        )}

        {protectedMode ? (
          storageProtection.writeConflict ? (
            <section role="alert" className="app-card mt-4 rounded-[1.25rem] border-amber-200 p-5 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><AlertTriangle className="h-5 w-5" /></div>
              <h2 className="text-base font-semibold text-slate-800">別の画面との編集競合を検出しました</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">RealitySyncの保存データが別タブや別ウィンドウでも変更されたため、自動でどちらかを上書きせず保存を停止しました。この画面の変更はメモリ上に残っています。</p>
              {storageProtection.conflictDomains.length > 0 && <p className="mt-2 text-xs font-medium text-amber-700">競合対象: {storageProtection.conflictDomains.join('・')}</p>}
              {storageProtection.conflictDateKeys.length > 0 && <p className="mt-2 text-xs font-medium text-amber-700">競合日: {storageProtection.conflictDateKeys.join('・')}</p>}
              <p className="mt-2 text-[10px] leading-relaxed text-slate-400">必要な内容をバックアップしてから、他のRealitySync画面を閉じて再読み込みしてください。</p>
              <button type="button" onClick={() => setIsSettingsOpen(true)} className="mt-4 min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">設定とデータを開く</button>
            </section>
          ) : (
            <section className="app-card mt-4 rounded-[1.25rem] border-red-200 p-5 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-500"><AlertTriangle className="h-5 w-5" /></div>
              <h2 className="text-base font-semibold text-slate-800">保存データを保護しています</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">現在版では保存済みデータを安全に読み取れないため、編集と自動保存を停止しました。元データは上書きしていません。</p>
              {storageProtection.protectedDomains.length > 0 && <p className="mt-2 text-xs font-medium text-slate-500">保護対象: {storageProtection.protectedDomains.join('・')}</p>}
              {storageProtection.unsupportedVersion !== null && <p className="mt-2 text-xs font-semibold text-red-600">検出した保存版: {String(storageProtection.unsupportedVersion)}</p>}
              <button type="button" onClick={() => setIsSettingsOpen(true)} className="mt-4 min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">設定とデータを開く</button>
            </section>
          )
        ) : (
          <>
            {activeTab === TABS.PLAN && <PlanView schedules={schedules} onCreate={() => setEditorState({ type: 'create' })} onEdit={openScheduleEditor} onCopyPrevious={copyPreviousDay} hasPreviousSchedules={previousSchedules.length > 0} onOpenTemplates={() => setIsTemplateModalOpen(true)} templateCount={templates.length} planFeedbackSuggestions={planFeedbackSuggestions} onReviewPlanFeedback={(suggestion) => setSelectedPlanFeedbackId(suggestion.id)} />}
            {activeTab === TABS.TRACK && <TrackView schedules={schedules} dueSchedules={dueSchedules} dateKey={selectedDate} canRecord={canRecordSelectedDate} onRecord={openRecord} />}
            {activeTab === TABS.ANALYTICS && <AnalyticsView stats={stats} plannedCount={schedules.length} weeklyInsights={weeklyInsights} monthlyInsights={monthlyInsights} longitudinalInsights={longitudinalInsights} selectedDate={selectedDate} onChangeDate={changeDate} />}
          </>
        )}
      </main>

      {!protectedMode && <BottomNav activeTab={activeTab} onChange={setActiveTab} />}
      {!protectedMode && canRecordSelectedDate && recordSession && <RecordModal key={`record:${recordSession.dateKey}:${String(recordSession.id)}:${recordSession.baseRevision}`} schedule={recordSession.schedule} dateKey={recordSession.dateKey} stale={recordSessionStale} onClose={() => setRecordSession(null)} onSave={saveRecord} />}
      {!protectedMode && selectedPlanFeedback && <PlanFeedbackModal preview={selectedPlanFeedback.preview} onApply={applySelectedPlanFeedback} onClose={() => setSelectedPlanFeedbackId(null)} />}
      {!protectedMode && editorState && <ScheduleEditorModal key={`editor:${selectedDate}:${editorState.type}:${editorState.type === 'edit' ? editorState.baseRevision : 'new'}`} schedule={editingSchedule} stale={editorSessionStale} onClose={() => setEditorState(null)} onSave={saveSchedule} onDelete={editorState.type === 'edit' ? deleteSchedule : undefined} />}
      {!protectedMode && isTemplateModalOpen && <TemplateModal templates={templates} currentSchedules={schedules} onClose={() => setIsTemplateModalOpen(false)} onSaveTemplate={(name) => saveTemplate(name, schedules)} onApplyTemplate={applyTemplate} onDeleteTemplate={deleteTemplate} />}
      {isSettingsOpen && <SettingsModal store={store} templates={templates} experiments={experiments} reminderPreferences={reminderPreferences} storageProtection={storageProtection} onChangeReminderPreferences={setReminderPreferences} onRestoreBackup={restoreBackup} onEraseAllData={eraseAllData} onOpenLegal={openLegal} canInstall={canInstall} isInstalled={isInstalled} isNativeShell={isNativeShell} onInstall={install} onClose={() => setIsSettingsOpen(false)} />}
      {legalPage && <LegalModal page={legalPage} onClose={() => setLegalPage(null)} />}
    </div>
  );
}
