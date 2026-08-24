import UIKit
import WebKit

final class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private var webRootURL: URL?

    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

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
