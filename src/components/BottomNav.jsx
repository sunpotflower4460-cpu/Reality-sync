import { BarChart3, Calendar, ListTodo } from 'lucide-react';
import { TABS } from '../constants.js';

const ITEMS = [
  { id: TABS.PLAN, label: '計画', Icon: ListTodo },
  { id: TABS.TRACK, label: '記録', Icon: Calendar },
  { id: TABS.ANALYTICS, label: '分析', Icon: BarChart3 },
];

export function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="fixed bottom-0 z-20 w-full border-t border-gray-200/80 bg-white/95 backdrop-blur-xl pb-safe" aria-label="メインナビゲーション">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-1 px-2 pt-2">
        {ITEMS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 transition-colors ${active ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
            >
              <Icon className="h-5.5 w-5.5" aria-hidden="true" />
              <span className="text-[11px] font-extrabold">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
