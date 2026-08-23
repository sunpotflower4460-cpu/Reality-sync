import { useMemo, useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { TABS } from './constants.js';
import { calculateStats } from './utils/schedule.js';
import { usePersistentSchedules } from './hooks/usePersistentSchedules.js';
import { AnalyticsView } from './components/AnalyticsView.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { ModalDialog } from './components/ModalDialog.jsx';
import { PlanView } from './components/PlanView.jsx';
import { RecordModal } from './components/RecordModal.jsx';
import { TrackView } from './components/TrackView.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState(TABS.TRACK);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const { schedules, setSchedules, resetSchedules } = usePersistentSchedules();
  const stats = useMemo(() => calculateStats(schedules), [schedules]);
  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId],
  );

  const saveRecord = (record) => {
    if (selectedScheduleId === null) return;
    setSchedules((current) => current.map((schedule) => schedule.id === selectedScheduleId ? { ...schedule, ...record } : schedule));
    setSelectedScheduleId(null);
  };

  const resetDemo = () => {
    const shouldReset = typeof window === 'undefined' || window.confirm('記録したデモデータをすべて初期状態に戻しますか？');
    if (!shouldReset) return;
    setSelectedScheduleId(null);
    setIsPlanModalOpen(false);
    resetSchedules();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 text-gray-800">
      <header className="sticky top-0 z-10 rounded-b-[2rem] bg-indigo-600 px-4 pb-6 pt-10 text-white shadow-md">
        <div className="mx-auto flex max-w-md items-end justify-between gap-4">
          <div><h1 className="mb-1 text-3xl font-extrabold tracking-tight">RealitySync</h1><p className="text-sm font-medium text-indigo-200">理想と現実のギャップを力に変える</p></div>
          <div className="flex gap-2">
            <button type="button" onClick={resetDemo} aria-label="デモデータをリセット" title="デモデータをリセット" className="rounded-full bg-white/15 p-2 text-white backdrop-blur-sm transition hover:bg-white/25"><RotateCcw className="h-5 w-5" /></button>
            {activeTab === TABS.PLAN && <button type="button" onClick={() => setIsPlanModalOpen(true)} aria-label="予定を追加" className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition hover:bg-white/30"><Plus className="h-5 w-5" /></button>}
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-2 max-w-md p-4">
        {activeTab === TABS.PLAN && <PlanView schedules={schedules} onOpenPlanModal={() => setIsPlanModalOpen(true)} />}
        {activeTab === TABS.TRACK && <TrackView schedules={schedules} onRecord={(schedule) => setSelectedScheduleId(schedule.id)} />}
        {activeTab === TABS.ANALYTICS && <AnalyticsView stats={stats} />}
      </main>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      {selectedSchedule && <RecordModal schedule={selectedSchedule} onClose={() => setSelectedScheduleId(null)} onSave={saveRecord} />}

      {isPlanModalOpen && (
        <ModalDialog
          onClose={() => setIsPlanModalOpen(false)}
          labelledBy="plan-modal-title"
          className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"><Plus className="h-6 w-6" /></div>
          <h3 id="plan-modal-title" className="mb-2 text-lg font-bold">予定の追加</h3>
          <p className="mb-6 text-sm text-gray-500">この最初のデモでは追加機能はまだ未実装です。まずは「記録 → 分析」のコアループを検証します。</p>
          <button type="button" onClick={() => setIsPlanModalOpen(false)} className="w-full rounded-xl bg-gray-100 py-3 font-bold text-gray-700">閉じる</button>
        </ModalDialog>
      )}
    </div>
  );
}
