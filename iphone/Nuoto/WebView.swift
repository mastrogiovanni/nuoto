import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.refreshControl = makeRefreshControl(coordinator: context.coordinator,
                                                               webView: webView)
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    // MARK: - Refresh control

    private func makeRefreshControl(coordinator: Coordinator, webView: WKWebView) -> UIRefreshControl {
        let rc = UIRefreshControl()
        coordinator.webView = webView
        rc.addTarget(coordinator,
                     action: #selector(Coordinator.handleRefresh(_:)),
                     for: .valueChanged)
        return rc
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, WKNavigationDelegate {
        weak var webView: WKWebView?

        @objc func handleRefresh(_ sender: UIRefreshControl) {
            webView?.reload()
            sender.endRefreshing()
        }

        func webView(_ webView: WKWebView,
                     didFailProvisionalNavigation navigation: WKNavigation!,
                     withError error: Error) {
            // Show a simple inline error page on network failure
            let html = """
            <html><body style='font-family:sans-serif;padding:40px;text-align:center'>
            <h2>Impossibile caricare la pagina</h2>
            <p>\(error.localizedDescription)</p>
            <p><a href='https://mastrogiovanni.ddns.net'>Riprova</a></p>
            </body></html>
            """
            webView.loadHTMLString(html, baseURL: nil)
        }
    }
}
