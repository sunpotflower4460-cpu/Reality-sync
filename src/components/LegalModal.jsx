import { ExternalLink, FileText, ShieldCheck, XCircle } from 'lucide-react';
import { SUPPORT_URL } from '../config/app.js';
import { ModalDialog } from './ModalDialog.jsx';

const EFFECTIVE_DATE = '2026年8月24日';

function PrivacyContent() {
  return (
    <div className="space-y-4 text-[11px] leading-relaxed text-slate-600">
      <section><h3 className="text-[12px] font-black text-slate-800">保存する情報</h3><p className="mt-1.5">RealitySyncは、予定、実績、開始日時、所要時間、想定/実際の負荷、気分、変更・スキップ理由、テンプレート、アプリ内で生成された学習用データを、この端末内に保存します。</p></section>
      <section><h3 className="text-[12px] font-black text-slate-800">外部への送信</h3><p className="mt-1.5">現行版にはアカウント、広告、アクセス解析、トラッキング、クラウド同期、開発者サーバーへの予定・実績送信はありません。App Store版の主要UIもアプリ本体に同梱して動作します。</p></section>
      <section><h3 className="text-[12px] font-black text-slate-800">バックアップと通知</h3><p className="mt-1.5">バックアップはユーザーが明示的に書き出したJSONファイルです。書き出したファイルの保管先はユーザーが管理します。通知を有効にした場合はOSの通知権限を使用しますが、現行版は広告・行動追跡目的の通知サーバーを使用しません。</p></section>
      <section><h3 className="text-[12px] font-black text-slate-800">削除</h3><p className="mt-1.5">設定とデータ画面の「この端末のデータをすべて削除」から、RealitySyncが端末内に保存した予定・実績・テンプレート・学習用データ・リマインダー設定を削除できます。すでに外部へ書き出したバックアップファイルは別途削除してください。</p></section>
      <section><h3 className="text-[12px] font-black text-slate-800">サポートページ</h3><p className="mt-1.5">サポートリンクを開くとGitHubへ移動します。移動後の通信やログの取扱いにはGitHub側のポリシーが適用されます。</p></section>
      <p className="text-[9px] text-slate-400">制定・最終更新: {EFFECTIVE_DATE}</p>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-4 text-[11px] leading-relaxed text-slate-600">
      <section><h3 className="text-[12px] font-black text-slate-800">サービスの目的</h3><p className="mt-1.5">RealitySyncは、理想の予定と実際の行動・負荷を記録して見比べ、次の予定を少し現実に合わせやすくするための個人向け記録ツールです。</p></section>
      <section><h3 className="text-[12px] font-black text-slate-800">医療・診断用途ではありません</h3><p className="mt-1.5">負荷や気分の記録・分析は医療行為、診断、治療、緊急対応を目的とするものではありません。健康上の判断が必要な場合は適切な専門家へ相談してください。</p></section>
      <section><h3 className="text-[12px] font-black text-slate-800">データ管理</h3><p className="mt-1.5">端末故障・削除・OS更新などに備え、必要な記録はバックアップ機能でユーザー自身が保全してください。バックアップJSONには予定や自由記述が含まれるため、共有・公開時は内容を確認してください。</p></section>
      <section><h3 className="text-[12px] font-black text-slate-800">提供内容の変更</h3><p className="mt-1.5">安全性・互換性・法令やストア要件への対応のため、機能や仕様を更新することがあります。過去の記録を現在の予定から推測して補完することは、RealitySyncの基本方針として行いません。</p></section>
      <p className="text-[9px] text-slate-400">制定・最終更新: {EFFECTIVE_DATE}</p>
    </div>
  );
}

export function LegalModal({ page, onClose }) {
  const privacy = page === 'privacy';
  const title = privacy ? 'プライバシーポリシー' : '利用規約';
  const Icon = privacy ? ShieldCheck : FileText;

  return (
    <ModalDialog
      onClose={onClose}
      labelledBy="legal-modal-title"
      placement="sheet"
      className="max-h-[94dvh] w-full max-w-sm overflow-y-auto rounded-t-[1.75rem] rounded-b-none bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:rounded-[1.75rem]"
    >
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/96 px-4 pb-3 pt-2 backdrop-blur-xl sm:pt-4">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-indigo-500" /><h2 id="legal-modal-title" className="text-[13px] font-black text-slate-800">{title}</h2></div>
          <button type="button" onClick={onClose} aria-label={`${title}を閉じる`} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400"><XCircle className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="p-4 pb-modal-safe">
        {privacy ? <PrivacyContent /> : <TermsContent />}
        <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-50 px-4 text-[10px] font-extrabold text-indigo-700">サポートを開く<ExternalLink className="h-3.5 w-3.5" /></a>
      </div>
    </ModalDialog>
  );
}
