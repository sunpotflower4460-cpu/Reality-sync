import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  HardDriveDownload,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { APP_VERSION, SUPPORT_PAGE_URL } from '../config/app.js';
import { serializeBackup, parseBackup } from '../utils/backup.js';
import { REMINDER_DELAY_OPTIONS } from '../utils/reminder.js';
import { ModalDialog } from './ModalDialog.jsx';

function backupFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `reality-sync-backup-${year}-${month}-${day}.json`;
}

export function SettingsModal({
  store,
  templates,
  experiments,
  reminderPreferences,
  storageProtection,
  onChangeReminderPreferences,
  onRestoreBackup,
  onEraseAllData,
  onOpenLegal,
  canInstall,
  isInstalled,
  isNativeShell = false,
  onInstall,
  onClose,
}) {
  const fileInputRef = useRef(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(() => (
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  ));
  const storageBlocked = Boolean(storageProtection?.persistenceBlocked);

  const exportBackup = () => {
    if (storageBlocked) {
      setMessage('');
      setError('保存済みデータを安全に読み込めていないため、バックアップ書き出しを停止しています。');
      return;
    }
    const text = serializeBackup({ store, templates, experiments, reminderPreferences });
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backupFilename();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setError('');
    setMessage('バックアップを書き出しました。');
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch {
      setMessage('');
      setError('ファイルを読み込めませんでした。');
      return;
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setMessage('');
      setError(parsed.error);
      return;
    }
    const { dayCount, scheduleCount, templateCount, experimentCount } = parsed.summary;
    const confirmed = window.confirm(
      `このバックアップで現在のRealitySyncデータを置き換えますか？\n\n予定・実績: ${scheduleCount}件 / ${dayCount}日\nテンプレート: ${templateCount}件\n内部の学習履歴: ${experimentCount}件\n\n現在の端末内データは置き換わります。必要なら先に書き出してください。`,
    );
    if (!confirmed) return;
    onRestoreBackup(parsed.data);
    setError('');
    setMessage('バックアップを復元しました。');
  };

  const requestNotifications = async () => {
    setMessage('');
    setError('');
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      setError('このブラウザはWeb通知に対応していません。アプリ内の記録待ちは利用できます。');
      return;
    }
    let permission;
    try {
      permission = await Notification.requestPermission();
    } catch {
      setError('通知許可を確認できませんでした。');
      return;
    }
    setNotificationPermission(permission);
    onChangeReminderPreferences((current) => ({ ...current, browserNotifications: permission === 'granted' }));
    if (permission === 'granted') setMessage('OS通知を有効にしました。');
    if (permission === 'denied') setError('通知が端末側で拒否されています。アプリ内の記録待ちは引き続き利用できます。');
  };

  const eraseAllData = () => {
    const first = window.confirm('この端末に保存されているRealitySyncの予定・実績・テンプレート・内部の学習履歴・リマインダー設定をすべて削除しますか？\n\nこの操作は取り消せません。必要な場合は先にバックアップを書き出してください。');
    if (!first) return;
    const second = window.confirm('最終確認です。外部へ書き出したバックアップ以外のRealitySync端末内データを削除します。実行しますか？');
    if (!second) return;
    onEraseAllData();
    setError('');
    setMessage('この端末のRealitySyncデータを削除しました。');
  };

  const openLegal = (page) => {
    onClose();
    onOpenLegal(page);
  };

  return (
    <ModalDialog
      onClose={onClose}
      labelledBy="settings-modal-title"
      placement="sheet"
      className="max-h-[94dvh] w-full max-w-sm overflow-y-auto rounded-t-[1.75rem] rounded-b-none bg-[#f7f8fb] shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:rounded-[1.75rem]"
    >
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/96 px-4 pb-3 pt-2 backdrop-blur-xl sm:pt-4">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="settings-modal-title" className="text-base font-black text-slate-900">設定とデータ</h2>
            <p className="mt-0.5 text-[9px] text-slate-400">記録・データ・プライバシー</p>
          </div>
          <button type="button" onClick={onClose} aria-label="設定を閉じる" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-4 pb-modal-safe">
        {storageBlocked && (
          <section className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[10px] leading-relaxed text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div><div className="font-extrabold">保存データ保護モード</div><p className="mt-1">現在の保存データを安全に解釈できないため、自動保存とバックアップ書き出しを止めています。元データは上書きしていません。{storageProtection.unsupportedVersion !== null ? ` 検出した保存版: ${String(storageProtection.unsupportedVersion)}` : ''}</p></div>
          </section>
        )}

        {(message || error) && (
          <div role={error ? 'alert' : 'status'} className={`rounded-xl border p-3 text-[10px] font-semibold leading-relaxed ${error ? 'border-rose-100 bg-rose-50 text-rose-600' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
            {error || message}
          </div>
        )}

        <section className="app-card rounded-[1.25rem] p-3.5">
          <div className="mb-3 flex items-center gap-2"><Bell className="h-4 w-4 text-indigo-500" /><h3 className="text-[13px] font-black text-slate-800">記録リマインダー</h3></div>
          <label className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3">
            <span><span className="block text-[12px] font-extrabold text-slate-700">アプリ内の記録待ち</span><span className="mt-0.5 block text-[9px] leading-relaxed text-slate-400">今日の未記録予定だけを表示</span></span>
            <span className="relative shrink-0">
              <input type="checkbox" checked={reminderPreferences.enabled} onChange={(event) => onChangeReminderPreferences((current) => ({ ...current, enabled: event.target.checked }))} className="peer sr-only" />
              <span className="block h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-indigo-600" />
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
            </span>
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-[10px] font-extrabold text-slate-500">記録待ちにするタイミング</span>
            <select value={reminderPreferences.delayMinutes} disabled={!reminderPreferences.enabled} onChange={(event) => onChangeReminderPreferences((current) => ({ ...current, delayMinutes: Number(event.target.value) }))} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-[12px] font-semibold text-slate-700 outline-none disabled:opacity-50">
              {REMINDER_DELAY_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes === 0 ? '予定時刻になったら' : `予定開始から${minutes}分後`}</option>)}
            </select>
          </label>
          {!isNativeShell && (
            <details className="group mt-3 rounded-xl border border-slate-100 bg-white">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 text-[10px] font-extrabold text-slate-500">
                <span className="flex items-center gap-2">{notificationPermission === 'granted' ? <Bell className="h-3.5 w-3.5 text-emerald-500" /> : <BellOff className="h-3.5 w-3.5 text-slate-400" />}Web版のOS通知</span><ChevronRight className="h-3.5 w-3.5 text-slate-300 transition group-open:rotate-90" />
              </summary>
              <div className="border-t border-slate-100 p-3"><p className="text-[9px] leading-relaxed text-slate-400">Web版では許可時にブラウザ通知を利用します。</p><button type="button" onClick={requestNotifications} className="mt-2 min-h-10 w-full rounded-xl bg-indigo-50 px-3 text-[10px] font-extrabold text-indigo-600">{notificationPermission === 'granted' ? '通知許可を確認済み' : 'OS通知を確認する'}</button></div>
            </details>
          )}
        </section>

        <section className="app-card rounded-[1.25rem] p-3.5">
          <div className="mb-2 flex items-center gap-2"><HardDriveDownload className="h-4 w-4 text-indigo-500" /><h3 className="text-[13px] font-black text-slate-800">バックアップ</h3></div>
          <p className="text-[9px] leading-relaxed text-slate-400">予定・実績・テンプレートなどをJSONに保存します。ファイル自体は暗号化されません。</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={exportBackup} disabled={storageBlocked} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-[10px] font-extrabold text-white disabled:cursor-not-allowed disabled:bg-slate-300"><Download className="h-3.5 w-3.5" />書き出す</button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-indigo-100 bg-white px-3 text-[10px] font-extrabold text-indigo-600"><Upload className="h-3.5 w-3.5" />復元する</button>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={importBackup} className="hidden" />
        </section>

        <section className="app-card overflow-hidden rounded-[1.25rem]">
          <div className="flex items-center gap-2 px-3.5 pb-2 pt-3.5"><ShieldCheck className="h-4 w-4 text-indigo-500" /><h3 className="text-[13px] font-black text-slate-800">プライバシーとサポート</h3></div>
          <p className="px-3.5 pb-3 text-[9px] leading-relaxed text-slate-400">現行版は予定や実績を端末内に保存し、広告・解析・トラッキング・クラウド同期を使いません。</p>
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            <button type="button" onClick={() => openLegal('privacy')} className="flex min-h-11 w-full items-center justify-between px-3.5 text-left text-[11px] font-extrabold text-slate-700"><span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />プライバシーポリシー</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>
            <button type="button" onClick={() => openLegal('terms')} className="flex min-h-11 w-full items-center justify-between px-3.5 text-left text-[11px] font-extrabold text-slate-700"><span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-indigo-400" />利用規約</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>
            <a href={SUPPORT_PAGE_URL} target="_blank" rel="noreferrer" className="flex min-h-11 w-full items-center justify-between px-3.5 text-[11px] font-extrabold text-slate-700"><span>サポート</span><ExternalLink className="h-3.5 w-3.5 text-slate-300" /></a>
          </div>
        </section>

        <section className="app-card rounded-[1.25rem] p-3.5">
          <div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-indigo-500" /><h3 className="text-[13px] font-black text-slate-800">RealitySync</h3></div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[9px] text-slate-400"><span>バージョン {APP_VERSION}</span>{isNativeShell ? <span className="font-bold text-emerald-600">App Store版</span> : isInstalled ? <span className="font-bold text-emerald-600">インストール済み</span> : null}</div>
          {!isNativeShell && !isInstalled && canInstall && <button type="button" onClick={onInstall} className="mt-3 min-h-10 w-full rounded-xl bg-slate-900 px-4 text-[10px] font-extrabold text-white">この端末にインストール</button>}
        </section>

        <button type="button" onClick={eraseAllData} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[10px] font-extrabold text-rose-500 transition hover:bg-rose-50"><Trash2 className="h-4 w-4" />この端末のデータをすべて削除</button>
      </div>
    </ModalDialog>
  );
}
