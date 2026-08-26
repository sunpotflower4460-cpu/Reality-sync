import UIKit
import UniformTypeIdentifiers
import WebKit

final class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, UIDocumentPickerDelegate {
    private enum BackupPickerOperation {
        case exporting
        case importing
    }

    private static let backupExportHandler = "realitySyncBackupExport"
    private static let backupImportHandler = "realitySyncBackupImport"
    private static let maximumBackupBytes = 10 * 1024 * 1024

    private var webView: WKWebView!
    private var webRootURL: URL?
    private var backupPickerOperation: BackupPickerOperation?
    private var pendingExportURL: URL?

    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.userContentController.add(self, name: Self.backupExportHandler)
        configuration.userContentController.add(self, name: Self.backupImportHandler)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.976, green: 0.980, blue: 0.984, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        self.webView = webView
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadBundledApp()
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: Self.backupExportHandler)
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: Self.backupImportHandler)
        cleanupPendingExport()
    }

    private func loadBundledApp() {
        guard
            let root = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true),
            FileManager.default.fileExists(atPath: root.path),
            FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path)
        else {
            showBundleError()
            return
        }

        webRootURL = root
        let indexURL = root.appendingPathComponent("index.html")
        webView.loadFileURL(indexURL, allowingReadAccessTo: root)
    }

    private func showBundleError() {
        let html = """
        <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{font-family:-apple-system;padding:48px 24px;color:#1f2937;background:#f9fafb}h1{font-size:22px}p{line-height:1.7;color:#6b7280}</style>
        <h1>RealitySyncを読み込めませんでした</h1>
        <p>アプリ内のWeb資産が見つかりません。開発ビルドでは、Xcodeを開く前にリポジトリ直下で <strong>npm run ios:prepare</strong> を実行してください。</p>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case Self.backupExportHandler:
            handleBackupExport(message.body)
        case Self.backupImportHandler:
            presentBackupImporter()
        default:
            break
        }
    }

    private func handleBackupExport(_ body: Any) {
        guard presentedViewController == nil else {
            sendBackupStatus(type: "error", message: "別の画面を閉じてからバックアップを書き出してください。")
            return
        }
        guard
            let payload = body as? [String: Any],
            let text = payload["text"] as? String,
            !text.isEmpty,
            text.utf8.count <= Self.maximumBackupBytes
        else {
            sendBackupStatus(type: "error", message: "バックアップデータを安全に書き出せませんでした。")
            return
        }

        let requestedName = (payload["filename"] as? String) ?? "reality-sync-backup.json"
        var filename = URL(fileURLWithPath: requestedName).lastPathComponent
        if filename.isEmpty { filename = "reality-sync-backup.json" }
        if !filename.lowercased().hasSuffix(".json") { filename += ".json" }

        cleanupPendingExport()
        let exportURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        do {
            try text.write(to: exportURL, atomically: true, encoding: .utf8)
        } catch {
            sendBackupStatus(type: "error", message: "バックアップファイルを作成できませんでした。")
            return
        }

        pendingExportURL = exportURL
        backupPickerOperation = .exporting
        let picker = UIDocumentPickerViewController(forExporting: [exportURL], asCopy: true)
        picker.delegate = self
        picker.shouldShowFileExtensions = true
        present(picker, animated: true)
    }

    private func presentBackupImporter() {
        guard presentedViewController == nil else {
            sendBackupStatus(type: "error", message: "別の画面を閉じてからバックアップを選択してください。")
            return
        }
        backupPickerOperation = .importing
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.json], asCopy: true)
        picker.delegate = self
        picker.allowsMultipleSelection = false
        picker.shouldShowFileExtensions = true
        present(picker, animated: true)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        let operation = backupPickerOperation
        backupPickerOperation = nil

        switch operation {
        case .exporting:
            cleanupPendingExport()
            sendBackupStatus(type: "success", message: "バックアップを書き出しました。")
        case .importing:
            guard let url = urls.first else { return }
            importBackup(from: url)
        case .none:
            break
        }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        let operation = backupPickerOperation
        if operation == .exporting { cleanupPendingExport() }
        backupPickerOperation = nil
        switch operation {
        case .exporting:
            sendBackupStatus(type: "info", message: "バックアップの書き出しをキャンセルしました。")
        case .importing:
            sendBackupStatus(type: "info", message: "バックアップの復元をキャンセルしました。")
        case .none:
            break
        }
    }

    private func importBackup(from url: URL) {
        let accessing = url.startAccessingSecurityScopedResource()
        defer {
            if accessing { url.stopAccessingSecurityScopedResource() }
        }

        do {
            let data = try Data(contentsOf: url, options: [.mappedIfSafe])
            guard data.count <= Self.maximumBackupBytes, let text = String(data: data, encoding: .utf8) else {
                sendBackupStatus(type: "error", message: "選択したバックアップを読み込めませんでした。")
                return
            }
            sendImportedBackup(text)
        } catch {
            sendBackupStatus(type: "error", message: "選択したバックアップを読み込めませんでした。")
        }
    }

    private func sendImportedBackup(_ text: String) {
        guard
            let data = try? JSONSerialization.data(withJSONObject: ["detail": text]),
            let payload = String(data: data, encoding: .utf8)
        else {
            sendBackupStatus(type: "error", message: "バックアップをアプリへ渡せませんでした。")
            return
        }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('realitysync:native-backup-import', \(payload)));", completionHandler: nil)
    }

    private func sendBackupStatus(type: String, message: String) {
        guard
            let data = try? JSONSerialization.data(withJSONObject: ["detail": ["type": type, "message": message]]),
            let payload = String(data: data, encoding: .utf8)
        else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('realitysync:native-backup-status', \(payload)));", completionHandler: nil)
    }

    private func cleanupPendingExport() {
        if let pendingExportURL {
            try? FileManager.default.removeItem(at: pendingExportURL)
        }
        pendingExportURL = nil
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if url.isFileURL {
            if let root = webRootURL, url.path.hasPrefix(root.path) {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
            }
            return
        }

        if let scheme = url.scheme?.lowercased(), ["https", "http", "mailto"].contains(scheme) {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard navigationAction.targetFrame == nil, let url = navigationAction.request.url else { return nil }
        if url.isFileURL {
            webView.load(navigationAction.request)
        } else if let scheme = url.scheme?.lowercased(), ["https", "http", "mailto"].contains(scheme) {
            UIApplication.shared.open(url)
        }
        return nil
    }
}
