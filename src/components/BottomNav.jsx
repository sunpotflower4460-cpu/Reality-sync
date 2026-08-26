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
      <div className="pointer-events-auto mx-auto max-w-sm rounded-[1.3rem] border border-white/90 bg-white/96 p-1 shadow-[0_10px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <div className="grid grid-cols-3 gap-1">
          {ITEMS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[1rem] px-2 transition-all ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 active:bg-slate-100'}`}
              >
                <Icon className={`h-[1.15rem] w-[1.15rem] ${active ? 'stroke-[2.5]' : ''}`} aria-hidden="true" />
                <span className={`text-[9px] font-extrabold tracking-wide ${active ? 'text-indigo-700' : ''}`}>{label}</span>
                {active && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-indigo-500" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
