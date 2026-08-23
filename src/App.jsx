import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { STATUS, TABS } from './constants.js';
import { dateKeyFromDate } from './utils/date.js';
import { calculateStats } from './utils/schedule.js';
import { usePersistentSchedules } from './hooks/usePersistentSchedules.js';
import { AnalyticsView } from './components/AnalyticsView.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { DateNavigator } from './components/DateNavigator.jsx';
import { PlanView } from './components/PlanView.jsx';
import { RecordModal } from './components/RecordModal.jsx';
import { ScheduleEditorModal } from './components/ScheduleEditorModal.jsx';
import { TrackView } from './components/TrackView.jsx';

function createScheduleId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState(TABS.TRACK);
  const [selectedDate, setSelectedDate] = useState(() => dateKeyFromDate());
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [editorState, setEditorState] = useState(null);
  const { schedules, setSchedules } = usePersistentSchedules(selectedDate);
  const stats = useMemo(() => calculateStats(schedules), [schedules]);

  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId],
  );
  const editingSchedule = useMemo(
    () => editorState?.type === 'edit'
      ? schedules.find((schedule) => schedule.id === editorState.id) ?? null
      : null,
    [editorState, schedules],
  );

  const changeDate = (dateKey) => {
    setSelectedScheduleId(null);
    setEditorState(null);
    setSelectedDate(dateKey);
  };

  const saveRecord = (record) => {
    if (selectedScheduleId === null) return;
    setSchedules((current) => current.map((schedule) => schedule.id === selectedScheduleId ? { ...schedule, ...record } : schedule));
    setSelectedScheduleId(null);
  };

  const saveSchedule = (draft) => {
    if (editorState?.type === 'edit') {
      setSchedules((current) => current.map((schedule) => schedule.id === editorState.id ? { ...schedule, ...draft } : schedule));
    } else {
      setSchedules((current) => [
        ...current,
        {
          id: createScheduleId(),
          ...draft,
          status: STATUS.PENDING,
          actualTitle: '',
          actualCategory: null,
          actualDuration: null,
          mood: null,
          actualStress: null,
        },
      ]);
    }
    setEditorState(null);
  };

  const deleteSchedule = (scheduleId) => {
    setSchedules((current) => current.filter((schedule) => schedule.id !== scheduleId));
    if (selectedScheduleId === scheduleId) setSelectedScheduleId(null);
    setEditorState(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 text-gray-800">
      <header className="sticky top-0 z-10 rounded-b-[2rem] bg-indigo-600 px-4 pb-5 pt-10 text-white shadow-md">
        <div className="mx-auto max-w-md">
          <div className="flex items-end justify-between gap-4">
            <div><h1 className="mb-1 text-3xl font-extrabold tracking-tight">RealitySync</h1><p className="text-sm font-medium text-indigo-200">理想と現実のギャップを力に変える</p></div>
            {activeTab === TABS.PLAN && (
              <button type="button" onClick={() => setEditorState({ type: 'create' })} aria-label="予定を追加" className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition hover:bg-white/30"><Plus className="h-5 w-5" /></button>
            )}
          </div>
          <DateNavigator dateKey={selectedDate} onChange={changeDate} />
        </div>
      </header>

      <main className="mx-auto -mt-2 max-w-md p-4">
        {activeTab === TABS.PLAN && (
          <PlanView
            schedules={schedules}
            onCreate={() => setEditorState({ type: 'create' })}
            onEdit={(id) => setEditorState({ type: 'edit', id })}
          />
        )}
        {activeTab === TABS.TRACK && <TrackView schedules={schedules} onRecord={(schedule) => setSelectedScheduleId(schedule.id)} />}
        {activeTab === TABS.ANALYTICS && <AnalyticsView stats={stats} />}
      </main>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      {selectedSchedule && <RecordModal schedule={selectedSchedule} onClose={() => setSelectedScheduleId(null)} onSave={saveRecord} />}
      {editorState && (
        <ScheduleEditorModal
          schedule={editingSchedule}
          onClose={() => setEditorState(null)}
          onSave={saveSchedule}
          onDelete={editorState.type === 'edit' ? deleteSchedule : undefined}
        />
      )}
    </div>
  );
}
