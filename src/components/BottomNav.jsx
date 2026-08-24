import { BarChart3, Calendar, ListTodo } from 'lucide-react';
import { TABS } from '../constants.js';

const ITEMS = [
  { id: TABS.PLAN, label: '計画', Icon: ListTodo },
  { id: TABS.TRACK, label: '記録', Icon: Calendar },
  { id: TABS.ANALYTICS, label: '分析', Icon: BarChart3 },
];

export function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pb-safe" aria-label="メインナビゲーション">
      <div className="pointer-events-auto mx-auto max-w-sm rounded-[1.45rem] border border-white/80 bg-white/94 p-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <div className="grid grid-cols-3 gap-1">
          {ITEMS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.1rem] px-2 transition-all ${active ? 'bg-indigo-600 text-white shadow-[0_6px_18px_rgba(79,70,229,0.24)]' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 active:bg-slate-100'}`}
              >
                <Icon className={`h-5 w-5 ${active ? 'stroke-[2.4]' : ''}`} aria-hidden="true" />
                <span className="text-[10px] font-extrabold tracking-wide">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
