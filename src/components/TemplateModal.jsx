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
      setError('テンプレートを保存できませんでした。保存状態が別の画面で変わっていないか確認してください。');
      return;
    }
    setName('');
    setError('');
  };

  const applyTemplate = (template) => {
    const applied = onApplyTemplate(template);
    if (applied === false) {
      setError('適用直前にこの日の予定または保存状態が変わりました。最新の内容を確認してからもう一度適用してください。');
    }
  };

  const deleteTemplate = (template) => {
    if (!window.confirm(`「${template.name}」を削除しますか？`)) return;
    const deleted = onDeleteTemplate(template.id);
    if (deleted === false) {
      setError('削除直前にテンプレートの保存状態が変わりました。最新の一覧を確認してからもう一度削除してください。');
    }
  };

  return (
    <ModalDialog
      onClose={onClose}
      labelledBy="template-modal-title"
      placement="sheet"
      className="max-h-[94dvh] w-full max-w-sm overflow-y-auto rounded-t-[1.75rem] rounded-b-none bg-[#f7f8fb] shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:rounded-[1.75rem]"
    >
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/96 px-4 pb-3 pt-2 backdrop-blur-xl sm:pt-4">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 id="template-modal-title" className="text-[13px] font-black text-slate-900">1日のテンプレート</h3>
            <p className="mt-0.5 text-[9px] text-slate-400">よく使う予定だけを保存。実績は入りません。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="テンプレート画面を閉じる" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400"><XCircle className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="space-y-4 p-4 pb-modal-safe">
        <section className="app-card rounded-[1.2rem] p-3.5">
          <h4 className="mb-2 text-[11px] font-black text-slate-700">この日の予定を保存</h4>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(event) => { setName(event.target.value); setError(''); }}
              placeholder="例: 平日 / 休日 / 制作日"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-indigo-400 focus:bg-white"
            />
            <button type="button" onClick={saveCurrent} className="flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-[10px] font-extrabold text-white hover:bg-indigo-700">
              <Plus className="h-4 w-4" />保存
            </button>
          </div>
          <p className="mt-2 text-[9px] text-slate-400">現在 {currentSchedules.length}件の予定があります。</p>
        </section>

        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5"><h4 className="text-[11px] font-black text-slate-700">保存済み</h4><span className="text-[9px] font-bold text-slate-400">{templates.length}件</span></div>
          {templates.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-[10px] leading-relaxed text-slate-500">まだテンプレートはありません。<br />使い回したい1日を保存してみましょう。</div>}
          {templates.map((template) => (
            <div key={template.id} className="app-card rounded-[1.15rem] p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div><div className="text-[12px] font-black text-slate-800">{template.name}</div><div className="mt-0.5 text-[9px] text-slate-400">{template.schedules.length}件の予定</div></div>
                <button type="button" onClick={() => deleteTemplate(template)} aria-label={`${template.name} を削除`} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <button type="button" onClick={() => applyTemplate(template)} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-indigo-50 text-[10px] font-extrabold text-indigo-600 hover:bg-indigo-100">
                <Copy className="h-3.5 w-3.5" />この日に適用する
              </button>
            </div>
          ))}
        </section>

        {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-[10px] font-semibold text-rose-600">{error}</p>}
      </div>
    </ModalDialog>
  );
}
