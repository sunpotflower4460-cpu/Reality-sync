import { BarChart3, Calendar, ListTodo } from 'lucide-react';
import { TABS } from '../constants.js';

const ITEMS = [
  { id: TABS.PLAN, label: '計画', Icon: ListTodo },
  { id: TABS.TRACK, label: '記録', Icon: Calendar },
  { id: TABS.ANALYTICS, label: '分析', Icon: BarChart3 },
];

export function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/75 bg-white/92 backdrop-blur-2xl" aria-label="メインナビゲーション">
      <div className="mx-auto max-w-md px-5 pb-safe pt-1">
        <div className="grid grid-cols-3">
          {ITEMS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-2 transition ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600 active:bg-slate-100/75'}`}
              >
                <Icon className={`h-[1.15rem] w-[1.15rem] ${active ? 'stroke-[2.35]' : 'stroke-[1.9]'}`} aria-hidden="true" />
                <span className={`text-[9px] tracking-wide ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
