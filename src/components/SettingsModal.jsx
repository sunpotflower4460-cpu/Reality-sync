import { useRef, useState } from 'react';
import { Bell, BellOff, Download, HardDriveDownload, Smartphone, Upload, XCircle } from 'lucide-react';
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
  reminderPreferences,
  onChangeReminderPreferences,
  onRestoreBackup,
  canInstall,
  isInstalled,
  onInstall,
  onClose,
}) {
  const fileInputRef = useRef(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(() => (
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  ));

  const exportBackup = () => {
    const text = serializeBackup({ store, templates, reminderPreferences });
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

    const { dayCount, scheduleCount, templateCount } = parsed.summary;
    const confirmed = window.confirm(
      `このバックアップで現在のRealitySyncデータを置き換えますか？\n\n予定・実績: ${scheduleCount}件 / ${dayCount}日\nテンプレート: ${templateCount}件\n\n現在のローカルデータは置き換わります。必要なら先に書き出してください。`,
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
    onChangeReminderPreferences((current) => ({
      ...current,
      browserNotifications: permission === 'granted',
    }));
    if (permission === 'granted') setMessage('OS通知を有効にしました。');
    if (permission === 'denied') setError('通知がブラウザ側で拒否されています。アプリ内の記録待ちは引き続き利用できます。');
  };

  return (
    <ModalDialog
      onClose={onClose}
      labelledBy="settings-modal-title"
      className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-2xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-4">
        <div>
          <h2 id="settings-modal-title" className="font-extrabold text-gray-800">設定とデータ</h2>
          <p className="mt-0.5 text-[10px] text-gray-400">端末内データの保全と記録忘れ対策</p>
        </div>
        <button type="button" onClick={onClose} aria-label="設定を閉じる" className="rounded-full bg-gray-100 p-1.5 text-gray-400 hover:text-gray-600"><XCircle className="h-5 w-5" /></button>
      </div>

      <div className="space-y-5 p-5">
        <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="mb-3 flex items-center gap-2"><Bell className="h-5 w-5 text-indigo-500" /><h3 className="font-bold text-gray-800">記録リマインダー</h3></div>
          <label className="flex items-center justify-between gap-4 rounded-xl bg-white p-3">
            <span><span className="block text-sm font-bold text-gray-700">アプリ内の記録待ち</span><span className="mt-0.5 block text-[10px] leading-relaxed text-gray-400">今日の未記録予定だけを表示します</span></span>
            <input
              type="checkbox"
              checked={reminderPreferences.enabled}
              onChange={(event) => onChangeReminderPreferences((current) => ({ ...current, enabled: event.target.checked }))}
              className="h-5 w-5 accent-indigo-600"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-bold text-gray-600">予定開始から何分後に記録待ちにするか</span>
            <select
              value={reminderPreferences.delayMinutes}
              disabled={!reminderPreferences.enabled}
              onChange={(event) => onChangeReminderPreferences((current) => ({ ...current, delayMinutes: Number(event.target.value) }))}
              className="w-full rounded-xl border border-indigo-100 bg-white p-3 text-sm text-gray-700 disabled:opacity-50"
            >
              {REMINDER_DELAY_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes === 0 ? '予定時刻になったら' : `${minutes}分後`}</option>)}
            </select>
          </label>

          <div className="mt-3 rounded-xl bg-white p-3">
            <div className="flex items-start gap-2">
              {notificationPermission === 'granted' ? <Bell className="mt-0.5 h-4 w-4 text-green-500" /> : <BellOff className="mt-0.5 h-4 w-4 text-gray-400" />}
              <div className="min-w-0 flex-1"><div className="text-xs font-bold text-gray-700">OS通知（任意）</div><p className="mt-1 text-[10px] leading-relaxed text-gray-400">許可した場合、アプリが起動中・再表示された時に記録待ちを通知できます。アプリを完全に閉じた状態での時刻指定通知は、現段階では保証しません。</p></div>
            </div>
            <button type="button" onClick={requestNotifications} className="mt-3 w-full rounded-xl border border-indigo-100 bg-indigo-50 py-2.5 text-xs font-bold text-indigo-600">
              {notificationPermission === 'granted' ? '通知許可を確認済み' : 'OS通知を許可する'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 p-4">
          <div className="mb-3 flex items-center gap-2"><HardDriveDownload className="h-5 w-5 text-indigo-500" /><h3 className="font-bold text-gray-800">バックアップ</h3></div>
          <p className="mb-3 text-[10px] leading-relaxed text-gray-500">予定・実績・テンプレート・リマインダー設定を1つのJSONに保存します。クラウド同期前のデータ保全として使えます。</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={exportBackup} className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white"><Download className="h-4 w-4" />書き出す</button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white py-3 text-xs font-bold text-indigo-600"><Upload className="h-4 w-4" />復元する</button>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={importBackup} className="hidden" />
        </section>

        <section className="rounded-2xl border border-gray-100 p-4">
          <div className="mb-2 flex items-center gap-2"><Smartphone className="h-5 w-5 text-indigo-500" /><h3 className="font-bold text-gray-800">アプリとして使う</h3></div>
          {isInstalled ? (
            <p className="text-xs font-medium text-green-600">この端末ではスタンドアロン表示で起動しています。</p>
          ) : canInstall ? (
            <button type="button" onClick={onInstall} className="mt-2 w-full rounded-xl bg-gray-900 py-3 text-xs font-bold text-white">この端末にインストール</button>
          ) : (
            <p className="text-[10px] leading-relaxed text-gray-500">対応ブラウザではブラウザメニューの「ホーム画面に追加」「アプリをインストール」から追加できます。iPhoneでは共有メニューからホーム画面へ追加できます。</p>
          )}
        </section>

        {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-xs font-medium text-green-700">{message}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium leading-relaxed text-red-600">{error}</p>}
      </div>
    </ModalDialog>
  );
}
