import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Download,
  ExternalLink,
  FileText,
  HardDriveDownload,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { APP_VERSION, SUPPORT_PAGE_URL } from '../config/app.js';
import { serializeBackup, parseBackup } from '../utils/backup.js';
import { REMINDER_DELAY_OPTIONS } from '../utils/reminder.js';
import { LegalModal } from './LegalModal.jsx';
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
  canInstall,
  isInstalled,
  isNativeShell = false,
  onInstall,
  onClose,
}) {
  const fileInputRef = useRef(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [legalPage, setLegalPage] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(() => (
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  ));
  const storageBlocked = Boolean(storageProtection?.persistenceBlocked);

  const exportBackup = () => {
    if (storageBlocked) {
      setMessage('');
      setError('保存済みデータを安全に読み込めていないため、空の状態をバックアップとして書き出す操作を停止しています。対応版で開くか、互換バックアップを復元してください。');
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
    try { text = await file.text(); } catch { setMessage(''); setError('ファイルを読み込めませんでした。'); return; }
    const parsed = parseBackup(text);
    if (!parsed.ok) { setMessage(''); setError(parsed.error); return; }
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
      setError(isNativeShell
        ? 'App Store版のネイティブ通知は現在準備中です。アプリ内の記録待ちは利用できます。'
        : 'このブラウザはWeb通知に対応していません。アプリ内の記録待ちは利用できます。');
      return;
    }
    let permission;
    try { permission = await Notification.requestPermission(); } catch { setError('通知許可を確認できませんでした。'); return; }
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

  return (
    <>
      <ModalDialog onClose={onClose} labelledBy="settings-modal-title" className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-4">
          <div><h2 id="settings-modal-title" className="font-extrabold text-gray-800">設定とデータ</h2><p className="mt-0.5 text-[10px] text-gray-400">端末内データの保全・プライバシー・記録忘れ対策</p></div>
          <button type="button" onClick={onClose} aria-label="設定を閉じる" className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:text-gray-600"><XCircle className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-5">
          {storageBlocked && <section className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs leading-relaxed text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><div className="font-extrabold">保存データ保護モード</div><p className="mt-1">現在の保存データを安全に解釈できないため、自動保存とバックアップ書き出しを止めています。元データは上書きしていません。{storageProtection.unsupportedVersion !== null ? ` 検出した保存版: ${String(storageProtection.unsupportedVersion)}` : ''}</p></div></section>}

          <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="mb-3 flex items-center gap-2"><Bell className="h-5 w-5 text-indigo-500" /><h3 className="font-bold text-gray-800">記録リマインダー</h3></div>
            <label className="flex items-center justify-between gap-4 rounded-xl bg-white p-3"><span><span className="block text-sm font-bold text-gray-700">アプリ内の記録待ち</span><span className="mt-0.5 block text-[10px] leading-relaxed text-gray-400">今日の未記録予定だけを表示します</span></span><input type="checkbox" checked={reminderPreferences.enabled} onChange={(event) => onChangeReminderPreferences((current) => ({ ...current, enabled: event.target.checked }))} className="h-5 w-5 accent-indigo-600" /></label>
            <label className="mt-3 block"><span className="mb-1.5 block text-xs font-bold text-gray-600">予定開始から何分後に記録待ちにするか</span><select value={reminderPreferences.delayMinutes} disabled={!reminderPreferences.enabled} onChange={(event) => onChangeReminderPreferences((current) => ({ ...current, delayMinutes: Number(event.target.value) }))} className="w-full rounded-xl border border-indigo-100 bg-white p-3 text-sm text-gray-700 disabled:opacity-50">{REMINDER_DELAY_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes === 0 ? '予定時刻になったら' : `${minutes}分後`}</option>)}</select></label>
            <div className="mt-3 rounded-xl bg-white p-3"><div className="flex items-start gap-2">{notificationPermission === 'granted' ? <Bell className="mt-0.5 h-4 w-4 text-green-500" /> : <BellOff className="mt-0.5 h-4 w-4 text-gray-400" />}<div className="min-w-0 flex-1"><div className="text-xs font-bold text-gray-700">OS通知（任意）</div><p className="mt-1 text-[10px] leading-relaxed text-gray-400">Web版では許可時にブラウザ通知を利用します。App Store版の閉じた状態でのネイティブ時刻通知は、対応するまで保証しません。</p></div></div><button type="button" onClick={requestNotifications} className="mt-3 min-h-11 w-full rounded-xl border border-indigo-100 bg-indigo-50 px-3 text-xs font-bold text-indigo-600">{notificationPermission === 'granted' ? '通知許可を確認済み' : 'OS通知を確認する'}</button></div>
          </section>

          <section className="rounded-2xl border border-gray-100 p-4">
            <div className="mb-3 flex items-center gap-2"><HardDriveDownload className="h-5 w-5 text-indigo-500" /><h3 className="font-bold text-gray-800">バックアップ</h3></div>
            <p className="mb-3 text-[10px] leading-relaxed text-gray-500">予定・実績・テンプレート・内部の学習履歴・リマインダー設定をJSONに保存します。JSON自体は暗号化されないため、共有や保管先に注意してください。</p>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={exportBackup} disabled={storageBlocked} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"><Download className="h-4 w-4" />書き出す</button><button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 text-xs font-bold text-indigo-600"><Upload className="h-4 w-4" />復元する</button></div>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={importBackup} className="hidden" />
          </section>

          <section className="rounded-2xl border border-gray-100 p-4">
            <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-indigo-500" /><h3 className="font-bold text-gray-800">プライバシーと法務</h3></div>
            <p className="mb-3 text-[10px] leading-relaxed text-gray-500">現行版はアカウント・広告・アクセス解析・トラッキング・クラウド同期を使わず、予定や実績は端末内に保存します。</p>
            <div className="space-y-2">
              <button type="button" onClick={() => setLegalPage('privacy')} className="flex min-h-11 w-full items-center justify-between rounded-xl bg-gray-50 px-3 text-left text-xs font-bold text-gray-700"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-indigo-500" />プライバシーポリシー</span><span>›</span></button>
              <button type="button" onClick={() => setLegalPage('terms')} className="flex min-h-11 w-full items-center justify-between rounded-xl bg-gray-50 px-3 text-left text-xs font-bold text-gray-700"><span className="flex items-center gap-2"><FileText className="h-4 w-4 text-indigo-500" />利用規約</span><span>›</span></button>
              <a href={SUPPORT_PAGE_URL} target="_blank" rel="noreferrer" className="flex min-h-11 w-full items-center justify-between rounded-xl bg-gray-50 px-3 text-xs font-bold text-gray-700"><span>サポート</span><ExternalLink className="h-4 w-4 text-gray-400" /></a>
            </div>
          </section>

          <section className="rounded-2xl border border-red-100 bg-red-50/40 p-4">
            <div className="mb-2 flex items-center gap-2"><Trash2 className="h-5 w-5 text-red-500" /><h3 className="font-bold text-gray-800">端末内データの削除</h3></div>
            <p className="text-[10px] leading-relaxed text-gray-500">予定・実績・テンプレート・内部の学習履歴・リマインダー設定をこの端末から削除します。外部へ書き出したバックアップは削除されません。</p>
            <button type="button" onClick={eraseAllData} className="mt-3 min-h-11 w-full rounded-xl border border-red-200 bg-white px-4 text-xs font-extrabold text-red-600">この端末のデータをすべて削除</button>
          </section>

          <section className="rounded-2xl border border-gray-100 p-4">
            <div className="mb-2 flex items-center gap-2"><Smartphone className="h-5 w-5 text-indigo-500" /><h3 className="font-bold text-gray-800">RealitySync</h3></div>
            <p className="text-[10px] leading-relaxed text-gray-500">バージョン {APP_VERSION}</p>
            {isNativeShell ? <p className="mt-2 text-xs font-medium text-green-600">App Store向けネイティブシェルで起動しています。</p> : isInstalled ? <p className="mt-2 text-xs font-medium text-green-600">この端末ではスタンドアロン表示で起動しています。</p> : canInstall ? <button type="button" onClick={onInstall} className="mt-3 min-h-11 w-full rounded-xl bg-gray-900 px-4 text-xs font-bold text-white">この端末にインストール</button> : <p className="mt-2 text-[10px] leading-relaxed text-gray-500">Web版はブラウザの「ホーム画面に追加」「アプリをインストール」から追加できます。</p>}
          </section>

          {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-xs font-medium text-green-700">{message}</p>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium leading-relaxed text-red-600">{error}</p>}
        </div>
      </ModalDialog>
      {legalPage && <LegalModal page={legalPage} onClose={() => setLegalPage(null)} />}
    </>
  );
}
