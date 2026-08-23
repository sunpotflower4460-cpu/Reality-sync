import { useState } from 'react';
import { Copy, Plus, Trash2, XCircle } from 'lucide-react';
import { ModalDialog } from './ModalDialog.jsx';

export function TemplateModal({ templates, currentSchedules, onClose, onSaveTemplate, onApplyTemplate, onDeleteTemplate }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const saveCurrent = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('テンプレート名を入力してください。');
      return;
    }
    if (currentSchedules.length === 0) {
      setError('予定が1件以上ある日にテンプレートを保存できます。');
      return;
    }
    const saved = onSaveTemplate(trimmed);
    if (!saved) {
      setError('テンプレートを保存できませんでした。');
      return;
    }
    setName('');
    setError('');
  };

  return (
    <ModalDialog
      onClose={onClose}
      labelledBy="template-modal-title"
      className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-2xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-4">
        <div>
          <h3 id="template-modal-title" className="font-bold text-gray-900">1日のテンプレート</h3>
          <p className="mt-0.5 text-[11px] text-gray-500">よく使う予定だけを保存します。実績は入りません。</p>
        </div>
        <button type="button" onClick={onClose} aria-label="テンプレート画面を閉じる" className="rounded-full p-1 text-gray-400 hover:bg-gray-100"><XCircle className="h-5 w-5" /></button>
      </div>

      <div className="space-y-5 p-5">
        <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <h4 className="mb-3 text-sm font-bold text-indigo-900">この日の予定をテンプレート化</h4>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(event) => { setName(event.target.value); setError(''); }}
              placeholder="例: 平日 / 休日 / 制作日"
              className="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
            <button type="button" onClick={saveCurrent} className="flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
              <Plus className="h-4 w-4" />保存
            </button>
          </div>
          <p className="mt-2 text-[10px] text-indigo-600">現在 {currentSchedules.length}件の予定があります。</p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between"><h4 className="text-sm font-bold text-gray-800">保存済み</h4><span className="text-xs text-gray-400">{templates.length}件</span></div>
          {templates.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-center text-xs leading-relaxed text-gray-500">まだテンプレートはありません。<br />使い回したい1日を保存してみましょう。</div>
          )}
          {templates.map((template) => (
            <div key={template.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div><div className="font-bold text-gray-800">{template.name}</div><div className="text-[10px] text-gray-500">{template.schedules.length}件の予定</div></div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`「${template.name}」を削除しますか？`)) onDeleteTemplate(template.id);
                  }}
                  aria-label={`${template.name} を削除`}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                ><Trash2 className="h-4 w-4" /></button>
              </div>
              <button type="button" onClick={() => onApplyTemplate(template)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold text-indigo-600 shadow-sm ring-1 ring-gray-100 hover:bg-indigo-50">
                <Copy className="h-4 w-4" />この日に適用する
              </button>
            </div>
          ))}
        </section>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}
      </div>
    </ModalDialog>
  );
}
