import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Calendar, ListTodo, Plus } from 'lucide-react';
import RecordModal from './components/RecordModal.jsx';
import { applyRecord, calculateStats, loadSchedules, saveSchedules } from './scheduleModel.js';
import AnalyticsView from './views/AnalyticsView.jsx';
import PlanView from './views/PlanView.jsx';
import TrackView from './views/TrackView.jsx';

const createForm = (schedule) => ({
  recordMode: schedule?.status !== 'pending' ? schedule.status : 'as_planned',
  actualTitle: schedule?.actualTitle || '',
  actualCategory: schedule?.actualCategory || schedule?.category || 'その他',
  mood: schedule?.mood || 'normal',
  actualStress: schedule?.actualStress ?? schedule?.plannedStress ?? 50,
});

export default function App() {
  const [activeTab, setActiveTab] = useState('track');
  const [schedules, setSchedules] = useState(() => loadSchedules());
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [recordForm, setRecordForm] = useState(() => createForm(null));
  const [recordError, setRecordError] = useState('');
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const stats = useMemo(() => calculateStats(schedules), [schedules]);

  useEffect(() => { saveSchedules(schedules); }, [schedules]);

  const openRecord = (schedule) => {
    setSelectedSchedule(schedule);
    setRecordForm(createForm(schedule));
    setRecordError('');
  };

  const closeRecord = () => {
    setSelectedSchedule(null);
    setRecordError('');
  };

  const saveRecord = () => {
    const result = applyRecord(selectedSchedule, recordForm);
    if (!result.ok) {
      setRecordError(result.error);
      return;
    }
    setSchedules((current) => current.map((schedule) => schedule.id === result.schedule.id ? result.schedule : schedule));
    closeRecord();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-800">
      <header className="sticky top-0 z-10 rounded-b-[2rem] bg-indigo-600 px-4 pb-6 pt-10 text-white shadow-md">
        <div className="mx-auto flex max-w-md items-end justify-between">
          <div><h1 className="mb-1 text-3xl font-extrabold tracking-tight">RealitySync</h1><p className="text-sm font-medium text-indigo-200">理想と現実のギャップを力に変える</p></div>
          {activeTab === 'plan' && <button type="button" aria-label="予定を追加する" onClick={() => setIsPlanModalOpen(true)} className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition-all hover:bg-white/30"><Plus className="h-5 w-5" /></button>}
        </div>
      </header>

      <main className="mx-auto -mt-2 max-w-md p-4">
        {activeTab === 'plan' && <PlanView schedules={schedules} onAdd={() => setIsPlanModalOpen(true)} />}
        {activeTab === 'track' && <TrackView schedules={schedules} onRecord={openRecord} />}
        {activeTab === 'analytics' && <AnalyticsView stats={stats} />}
      </main>

      <nav className="pb-safe fixed bottom-0 z-20 w-full border-t border-gray-200 bg-white" aria-label="メインナビゲーション">
        <div className="mx-auto flex max-w-md justify-around p-3">
          <NavButton value="plan" active={activeTab} onClick={setActiveTab} icon={ListTodo} label="計画" />
          <NavButton value="track" active={activeTab} onClick={setActiveTab} icon={Calendar} label="記録" />
          <NavButton value="analytics" active={activeTab} onClick={setActiveTab} icon={BarChart3} label="分析" />
        </div>
      </nav>

      <RecordModal schedule={selectedSchedule} form={recordForm} setForm={setRecordForm} error={recordError} onClose={closeRecord} onSave={saveRecord} />

      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in" role="presentation">
          <section className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="plan-dialog-title">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"><Plus className="h-6 w-6" /></div>
            <h2 id="plan-dialog-title" className="mb-2 text-lg font-bold">予定の追加</h2>
            <p className="mb-6 text-sm text-gray-500">デモ版ではスケジュールの追加はまだできません。初期データをご利用ください。</p>
            <button type="button" onClick={() => setIsPlanModalOpen(false)} className="w-full rounded-xl bg-gray-100 py-3 font-bold text-gray-700">閉じる</button>
          </section>
        </div>
      )}
    </div>
  );
}

function NavButton({ value, active, onClick, icon: Icon, label }) {
  const selected = active === value;
  return <button type="button" aria-current={selected ? 'page' : undefined} onClick={() => onClick(value)} className={`flex flex-1 flex-col items-center gap-1 ${selected ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><Icon className="h-6 w-6" /><span className="text-[10px] font-bold">{label}</span></button>;
}
