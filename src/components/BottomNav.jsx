import { BarChart3, Calendar, ListTodo } from 'lucide-react';
import { TABS } from '../constants.js';

const ITEMS = [
  { id: TABS.PLAN, label: '計画', Icon: ListTodo },
  { id: TABS.TRACK, label: '記録', Icon: Calendar },
  { id: TABS.ANALYTICS, label: '分析', Icon: BarChart3 },
];

export function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="fixed bottom-0 z-20 w-full border-t border-gray-200 bg-white/95 backdrop-blur pb-safe" aria-label="メインナビゲーション">
      <div className="mx-auto flex max-w-md justify-around p-3">
        {ITEMS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} type="button" onClick={() => onChange(id)} aria-current={active ? 'page' : undefined} className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1 transition-colors ${active ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <Icon className="h-6 w-6" aria-hidden="true" />
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
