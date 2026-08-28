import { useCallback, useEffect, useRef, useState } from 'react';
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
import { MAX_BACKUP_BYTES, serializeBackup, parseBackup } from '../utils/backup.js';
import { REMINDER_DELAY_OPTIONS } from '../utils/reminder.js';
import {
  BACKUP_RESTORED_EVENT,
  eraseStoredRealitySyncData,
  persistRestoredBackup,
} from '../utils/restore.js';
import { ModalDialog } from './ModalDialog.jsx';

function backupFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `reality-sync-backup-${year}-${month}-${day}.json`;
}

function nativeMessageHandler(name) {
  if (typeof window === 'undefined') return null;
  return window.webkit?.messageHandlers?.[name] ?? null;
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
  const storageWriteFailed = Boolean(storageProtection?.writeFailed);
  const storageConflict = Boolean(storageProtection?.writeConflict);
  const reminderEditingDisabled = storageBlocked || storageConflict;

  const restoreBackupText = useCallback((text) => {
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

    const persistence = persistRestoredBackup(parsed.data);
    if (!persistence.ok) {
      setMessage('');
      setError(persistence.rollbackOk
        ? 'バックアップの復元中に端末保存へ失敗しました。元の端末データへ戻したため、画面の内容は変更していません。'
        : 'バックアップの復元中に端末保存へ失敗し、元データへの戻しも完了確認できませんでした。アプリを再読み込みせず、可能なら現在見えているデータを外部へ控えてください。');
      return;
    }

    onRestoreBackup(parsed.data);
    window.dispatchEvent(new Event(BACKUP_RESTORED_EVENT));
    setError('');
    setMessage('バックアップを復元しました。');
  }, [onRestoreBackup]);

  useEffect(() => {
    if (!isNativeShell || typeof window === 'undefined') return undefined;

    const receiveImport = (event) => {
      if (typeof event.detail !== 'string') {
        setMessage('');
        setError('バックアップをアプリへ渡せませんでした。');
        return;
      }
      restoreBackupText(event.detail);
    };
    const receiveStatus = (event) => {
      const detail = event.detail;
      if (!detail || typeof detail.message !== 'string') return;
      if (detail.type === 'error') {
        setMessage('');
        setError(detail.message);
        return;
      }
      setError('');
      setMessage(detail.message);
    };

    window.addEventListener('realitysync:native-backup-import', receiveImport);
    window.addEventListener('realitysync:native-backup-status', receiveStatus);
    return () => {
      window.removeEventListener('realitysync:native-backup-import', receiveImport);
      window.removeEventListener('realitysync:native-backup-status', receiveStatus);
    };
  }, [isNativeShell, restoreBackupText]);

  const exportBackup = () => {
    if (storageBlocked) {
      setMessage('');
      setError('保存済みデータを安全に読み込めていないため、バックアップ書き出しを停止しています。');
      return;
    }
    const text = serializeBackup({ store, templates, experiments, reminderPreferences });
    const byteLength = new TextEncoder().encode(text).byteLength;
    if (byteLength > MAX_BACKUP_BYTES) {
      setMessage('');
      setError('現在のバックアップ上限10MBを超えているため、この状態では書き出せません。');
      return;
    }

    if (isNativeShell) {
      const handler = nativeMessageHandler('realitySyncBackupExport');
      if (!handler?.postMessage) {
        setMessage('');
        setError('バックアップの保存画面を開けませんでした。');
        return;
      }
      handler.postMessage({ filename: backupFilename(), text });
      setError('');
      setMessage('バックアップの保存先を選択してください。');
      return;
    }

    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backupFilename();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoke after the click task so Safari/WebKit has time to consume the URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setError('');
    setMessage('バックアップを書き出しました。');
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!Number.isFinite(file.size) || file.size > MAX_BACKUP_BYTES) {
      setMessage('');
      setError('バックアップファイルが大きすぎます。10MB以下のファイルを選択してください。');
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch {
      setMessage('');
      setError('ファイルを読み込めませんでした。');
      return;
    }
    restoreBackupText(text);
  };

  const openBackupImport = () => {
    if (!isNativeShell) {
      fileInputRef.current?.click();
      return;
    }
    const handler = nativeMessageHandler('realitySyncBackupImport');
    if (!handler?.postMessage) {
      setMessage('');
      setError('バックアップの選択画面を開けませんでした。');
      return;
    }
    setMessage('');
    setError('');
    handler.postMessage(null);
  };

  const requestNotifications = async () => {
    setMessage('');
    setError('');
    if (reminderEditingDisabled) {
      setError(storageConflict
        ? '別の画面との編集競合を解決してからリマインダー設定を変更してください。'
        : '保存データ保護モード中はリマインダー設定を変更できません。');
      return;
    }
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

    const erased = eraseStoredRealitySyncData();
    if (!erased) {
      setMessage('');
      setError('端末保存領域からすべて削除できたことを確認できなかったため、画面のデータも変更していません。再読み込みせず、必要なら先にバックアップを書き出してください。');
      return;
    }
    onEraseAllData();
    window.dispatchEvent(new Event(BACKUP_RESTORED_EVENT));
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
      className="sheet-scroll max-h-[94dvh] w-full max-w-sm overflow-y-auto rounded-t-[1.65rem] rounded-b-none bg-[#f6f7fb] shadow-[0_22px_64px_rgba(15,23,42,0.24)] sm:rounded-[1.65rem]"
    >
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/96 px-4 pb-3 pt-2 backdrop-blur-2xl sm:pt-4">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="settings-modal-title" className="text-[16px] font-semibold tracking-[-0.02em] text-slate-900">設定とデータ</h2>
            <p className="mt-0.5 text-[9px] text-slate-400">記録・データ・プライバシー</p>
          </div>
          <button type="button" onClick={onClose} aria-label="設定を閉じる" className="tap-target flex items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-3.5 pb-modal-safe">
        {storageBlocked && (
          <section className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[9px] leading-relaxed text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div><div className="font-semibold">保存データ保護モード</div><p className="mt-1">現在の保存データを安全に解釈できないため、自動保存とバックアップ書き出しを止めています。元データは上書きしていません。{storageProtection.unsupportedVersion !== null ? ` 検出した保存版: ${String(storageProtection.unsupportedVersion)}` : ''}</p></div>
          </section>
        )}

        {storageConflict && !storageBlocked && (
          <section className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[9px] leading-relaxed text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div><div className="font-semibold">別の画面との編集競合</div><p className="mt-1">別タブや別ウィンドウでも保存データが変更されました。現在画面の内容はメモリ上に残しています。必要ならバックアップを書き出してから、他のRealitySync画面を閉じて再読み込みしてください。{storageProtection.conflictDomains?.length ? ` 競合対象: ${storageProtection.conflictDomains.join('・')}` : ''}</p></div>
          </section>
        )}

        {storageWriteFailed && !storageBlocked && !storageConflict && (
          <section className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[9px] leading-relaxed text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div><div className="font-semibold">端末保存が完了していません</div><p className="mt-1">画面上の最新データを端末へ書き込めていません。再読み込み前にバックアップを書き出すことをおすすめします。バックアップ機能はこの状態でも利用できます。</p></div>
          </section>
        )}

        {(message || error) && (
          <div role={error ? 'alert' : 'status'} aria-live="polite" className={`rounded-xl border p-3 text-[9px] font-medium leading-relaxed ${error ? 'border-rose-100 bg-rose-50 text-rose-600' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
            {error || message}
          </div>
        )}

        <section>
          <SectionLabel icon={Bell}>記録</SectionLabel>
          <div className="app-group divide-y divide-slate-100">
            <label className="flex min-h-14 items-center justify-between gap-4 px-3.5 py-2.5">
              <span><span className="block text-[11px] font-semibold text-slate-700">アプリ内の記録待ち</span><span className="mt-0.5 block text-[8px] leading-relaxed text-slate-400">今日の未記録予定だけを表示</span></span>
              <Toggle checked={reminderPreferences.enabled} disabled={reminderEditingDisabled} onChange={(checked) => onChangeReminderPreferences((current) => ({ ...current, enabled: checked }))} />
            </label>

            <label className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="text-[10px] font-medium text-slate-600">記録待ちのタイミング</span>
              <select value={reminderPreferences.delayMinutes} disabled={!reminderPreferences.enabled || reminderEditingDisabled} onChange={(event) => onChangeReminderPreferences((current) => ({ ...current, delayMinutes: Number(event.target.value) }))} className="max-w-[11.5rem] rounded-lg border-0 bg-slate-50 px-2.5 py-2 text-right text-[10px] font-medium text-slate-700 outline-none disabled:opacity-45">
                {REMINDER_DELAY_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes === 0 ? '予定時刻になったら' : `開始から${minutes}分後`}</option>)}
              </select>
            </label>

            {!isNativeShell && (
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 text-[10px] font-medium text-slate-600">
                  <span className="flex items-center gap-2">{notificationPermission === 'granted' ? <Bell className="h-3.5 w-3.5 text-emerald-500" /> : <BellOff className="h-3.5 w-3.5 text-slate-400" />}Web版のOS通知</span><ChevronRight className="h-3.5 w-3.5 text-slate-300 transition group-open:rotate-90" />
                </summary>
                <div className="border-t border-slate-100 bg-slate-50/60 p-3"><p className="text-[8px] leading-relaxed text-slate-400">Web版では許可時にブラウザ通知を利用します。</p><button type="button" onClick={requestNotifications} disabled={reminderEditingDisabled} className="mt-2 min-h-10 w-full rounded-xl bg-white px-3 text-[9px] font-semibold text-indigo-600 ring-1 ring-slate-200 disabled:cursor-not-allowed disabled:opacity-40">{notificationPermission === 'granted' ? '通知許可を確認済み' : 'OS通知を確認する'}</button></div>
              </details>
            )}
          </div>
        </section>

        <section>
          <SectionLabel icon={HardDriveDownload}>データ</SectionLabel>
          <div className="app-group divide-y divide-slate-100">
            <div className="px-3.5 py-3"><p className="text-[10px] font-semibold text-slate-700">バックアップ</p><p className="mt-1 text-[8px] leading-relaxed text-slate-400">予定・実績・テンプレートなどをJSONに保存します。ファイル自体は暗号化されません。</p></div>
            <button type="button" onClick={exportBackup} disabled={storageBlocked} className="flex min-h-12 w-full items-center justify-between px-3.5 text-left text-[10px] font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><span className="flex items-center gap-2.5"><Download className="h-4 w-4 text-indigo-500" />バックアップを書き出す</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>
            <button type="button" onClick={openBackupImport} className="flex min-h-12 w-full items-center justify-between px-3.5 text-left text-[10px] font-medium text-slate-700"><span className="flex items-center gap-2.5"><Upload className="h-4 w-4 text-indigo-500" />バックアップから復元</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={importBackup} className="hidden" />
          </div>
        </section>

        <section>
          <SectionLabel icon={ShieldCheck}>プライバシーとサポート</SectionLabel>
          <div className="app-group divide-y divide-slate-100">
            <div className="px-3.5 py-3 text-[8px] leading-relaxed text-slate-400">現行版は予定や実績を端末内に保存し、広告・解析・トラッキング・クラウド同期を使いません。</div>
            <button type="button" onClick={() => openLegal('privacy')} className="flex min-h-12 w-full items-center justify-between px-3.5 text-left text-[10px] font-medium text-slate-700"><span>プライバシーポリシー</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>
            <button type="button" onClick={() => openLegal('terms')} className="flex min-h-12 w-full items-center justify-between px-3.5 text-left text-[10px] font-medium text-slate-700"><span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-slate-400" />利用規約</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>
            <a href={SUPPORT_PAGE_URL} target="_blank" rel="noreferrer" className="flex min-h-12 w-full items-center justify-between px-3.5 text-[10px] font-medium text-slate-700"><span>サポート</span><ExternalLink className="h-3.5 w-3.5 text-slate-300" /></a>
          </div>
        </section>

        <section>
          <SectionLabel icon={Smartphone}>アプリ</SectionLabel>
          <div className="app-group divide-y divide-slate-100">
            <div className="flex min-h-12 items-center justify-between gap-3 px-3.5 text-[10px] text-slate-600"><span>RealitySync</span><span className="text-[9px] text-slate-400">v{APP_VERSION}</span></div>
            <div className="flex min-h-12 items-center justify-between gap-3 px-3.5 text-[10px] text-slate-600"><span>状態</span><span className="text-[9px] font-medium text-emerald-600">{isNativeShell ? 'App Store版' : isInstalled ? 'インストール済み' : 'Web版'}</span></div>
            {!isNativeShell && !isInstalled && canInstall && <button type="button" onClick={onInstall} className="flex min-h-12 w-full items-center justify-between px-3.5 text-left text-[10px] font-medium text-indigo-600"><span>この端末にインストール</span><ChevronRight className="h-4 w-4 text-indigo-300" /></button>}
          </div>
        </section>

        <section>
          <p className="app-section-label text-rose-400">データの削除</p>
          <div className="app-group">
            <button type="button" onClick={eraseAllData} className="flex min-h-12 w-full items-center justify-between px-3.5 text-left text-[10px] font-medium text-rose-500 transition hover:bg-rose-50"><span className="flex items-center gap-2.5"><Trash2 className="h-4 w-4" />この端末のデータをすべて削除</span><ChevronRight className="h-4 w-4 text-rose-200" /></button>
          </div>
          <p className="mt-1.5 px-1 text-[8px] leading-relaxed text-slate-400">外部へ書き出したバックアップは削除されません。</p>
        </section>
      </div>
    </ModalDialog>
  );
}

function SectionLabel({ icon: Icon, children }) {
  return <p className="app-section-label flex items-center gap-1.5"><Icon className="h-3 w-3 text-indigo-400" aria-hidden="true" />{children}</p>;
}

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <span className={`relative shrink-0 ${disabled ? 'opacity-45' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span className="block h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-indigo-600" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
    </span>
  );
}
