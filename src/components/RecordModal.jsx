import { AlertCircle, CheckCircle2, Clock, Frown, Meh, Smile, XCircle } from 'lucide-react';

const MODES = [
  { value: 'as_planned', label: '予定通り実行した', icon: CheckCircle2, active: 'border-green-500 bg-green-50 text-green-700', iconActive: 'text-green-500' },
  { value: 'changed', label: '予定を変更して行動した', icon: AlertCircle, active: 'border-orange-500 bg-orange-50 text-orange-700', iconActive: 'text-orange-500' },
  { value: 'skipped', label: 'スキップした（休んだ）', icon: XCircle, active: 'border-red-500 bg-red-50 text-red-700', iconActive: 'text-red-500' },
];

const MOODS = [
  { value: 'good', label: '良い', icon: Smile },
  { value: 'normal', label: '普通', icon: Meh },
  { value: 'bad', label: '疲れた', icon: Frown },
];

const CATEGORIES = ['仕事', '運動', '休憩', '自己啓発', '趣味', '家事', 'その他'];

export default function RecordModal({ schedule, form, setForm, error, onClose, onSave }) {
  if (!schedule) return null;

  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in" role="presentation">
      <section className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="record-title">
        <header className="sticky top-0 z-10 flex items-center justify-between bg-indigo-50 p-4">
          <h2 id="record-title" className="font-bold text-indigo-900">実績を記録する</h2>
          <button type="button" aria-label="記録画面を閉じる" onClick={onClose} className="rounded-full bg-white p-1 text-gray-400 shadow-sm hover:text-gray-600">
            <XCircle className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-6 p-5">
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
            <Clock className="h-5 w-5 text-indigo-400" />
            <div>
              <div className="font-medium text-gray-500">{schedule.time}</div>
              <div className="font-bold text-gray-800">{schedule.title}</div>
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-gray-700">実際にはどうでしたか？</legend>
            <div className="grid gap-2">
              {MODES.map(({ value, label, icon: Icon, active, iconActive }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={form.recordMode === value}
                  onClick={() => update({ recordMode: value })}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${form.recordMode === value ? `${active} shadow-sm` : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <Icon className={`h-5 w-5 ${form.recordMode === value ? iconActive : 'text-gray-400'}`} />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {form.recordMode === 'changed' && (
            <div className="space-y-4 rounded-xl border border-orange-100 bg-orange-50 p-4 animate-in slide-in-from-top-2">
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-orange-800">代わりに行ったこと</span>
                <input
                  type="text"
                  value={form.actualTitle}
                  onChange={(event) => update({ actualTitle: event.target.value })}
                  placeholder="例: ベッドで本を読んだ"
                  className="w-full rounded-xl border border-orange-200 bg-white p-3 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-orange-800">そのカテゴリ（結果的な積み重ね）</span>
                <select
                  value={form.actualCategory}
                  onChange={(event) => update({ actualCategory: event.target.value })}
                  className="w-full rounded-xl border border-orange-200 bg-white p-3 text-gray-700 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                >
                  {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
            </div>
          )}

          {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}

          <label className="block space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="flex items-end justify-between">
              <span className="text-sm font-bold text-gray-700">実際のストレス・負荷</span>
              <span className={`text-lg font-black ${form.actualStress > 80 ? 'text-red-500' : 'text-indigo-600'}`}>{form.actualStress}</span>
            </div>
            <p className="text-[10px] text-gray-500">計画時の想定負荷は <b>{schedule.plannedStress}</b> でした。実際はどう感じましたか？</p>
            <input type="range" min="0" max="100" value={form.actualStress} onChange={(event) => update({ actualStress: Number(event.target.value) })} className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-indigo-600" />
            <span className="flex justify-between text-[10px] font-bold text-gray-400"><span>0（楽勝）</span><span>100（限界）</span></span>
          </label>

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-gray-700">終了時の気分は？</legend>
            <div className="flex gap-2">
              {MOODS.map(({ value, label, icon: Icon }) => (
                <button key={value} type="button" aria-pressed={form.mood === value} onClick={() => update({ mood: value })} className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-3 transition-all ${form.mood === value ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  <Icon className="h-6 w-6" /><span className="text-xs font-bold">{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <footer className="sticky bottom-0 z-10 border-t border-gray-100 bg-white p-4">
          <button type="button" onClick={onSave} className="w-full rounded-xl bg-indigo-600 py-3.5 font-bold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-[0.98]">記録を保存する</button>
        </footer>
      </section>
    </div>
  );
}
