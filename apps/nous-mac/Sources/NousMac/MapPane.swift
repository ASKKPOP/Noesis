import SwiftUI
import WebKit

/// The Portal's map of Grids, shown live from the Portal itself. This app draws nothing
/// of its own here: the map, its data and the way into a Grid are the Portal's page.
struct MapPane: View {
    @EnvironmentObject private var app: AppModel
    @ObservedObject var browser: MapBrowser

    private var address: URL? {
        guard let url = URL(string: app.settings.mapURL.trimmingCharacters(in: .whitespaces)),
              let scheme = url.scheme, ["http", "https"].contains(scheme), url.host != nil else { return nil }
        return url
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Button { browser.web.goBack() } label: { Image(systemName: "chevron.left") }
                    .disabled(!browser.canGoBack)
                    .accessibilityLabel("Back")
                Button { open() } label: { Image(systemName: "house") }
                    .accessibilityLabel("Back to the map")
                Button { browser.web.reload() } label: { Image(systemName: "arrow.clockwise") }
                    .accessibilityLabel("Reload")
                Text(browser.current?.absoluteString ?? app.settings.mapURL)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .textSelection(.enabled)
                if browser.loading { ProgressView().controlSize(.small) }
                Spacer()
                if browser.signedIn {
                    Label("Signed in", systemImage: "person.crop.circle.badge.checkmark").foregroundStyle(.secondary)
                } else if let address {
                    Button("Sign In") { browser.open(MapBrowser.page("/portal/auth", on: address)) }
                }
                Button("Open in Browser") {
                    if let url = browser.current ?? address { NSWorkspace.shared.open(url) }
                }
                .disabled(address == nil)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            Divider()
            if address == nil {
                Notice(symbol: "globe", title: "No map address",
                       message: "Set the Portal's map address under Settings, for example https://noesiis.com/worldmap/orbital.")
            } else if let problem = browser.problem {
                VStack(spacing: 14) {
                    Notice(symbol: "wifi.exclamationmark", title: "The map could not be opened", message: problem)
                        .frame(maxHeight: 220)
                    Button("Try Again") { open() }.buttonStyle(.borderedProminent)
                    Spacer()
                }
            } else {
                WebView(web: browser.web)
            }
        }
        .onAppear { if !browser.started { open() } }
        .onChange(of: app.settings.mapURL) { _, _ in open() }
    }

    private func open() {
        if let address { browser.open(address) }
    }
}

/// One web view and what it is doing.
@MainActor
final class MapBrowser: NSObject, ObservableObject, WKNavigationDelegate {
    let web = WKWebView()
    @Published var loading = false
    @Published var canGoBack = false
    @Published var current: URL?
    @Published var problem: String?
    /// Something has been asked for, so the pane need not open the map itself.
    private(set) var started = false
    /// A human is signed in to the Portal in this web view.
    @Published var signedIn = false

    override init() {
        super.init()
        web.navigationDelegate = self
    }

    func open(_ url: URL) {
        started = true
        problem = nil
        web.load(URLRequest(url: url))
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        loading = true
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        (loading, canGoBack, current) = (false, webView.canGoBack, webView.url)
        // The Portal keeps a signed-in human in this cookie (COOKIE_NAME in grid/src/api/portal/auth.ts).
        webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { [weak self] cookies in
            let now = Date()
            let held = cookies.contains { $0.name == "noesis_portal_token" && ($0.expiresDate ?? .distantFuture) > now }
            Task { @MainActor in self?.signedIn = held }
        }
    }

    /// A page of the same site as `address`.
    static func page(_ path: String, on address: URL) -> URL {
        var parts = URLComponents(url: address, resolvingAgainstBaseURL: false) ?? URLComponents()
        (parts.path, parts.query, parts.fragment) = (path, nil, nil)
        return parts.url ?? address
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        failed(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        failed(error)
    }

    private func failed(_ error: Error) {
        loading = false
        // A navigation replaced by a newer one is not a failure.
        if (error as NSError).code != NSURLErrorCancelled { problem = error.localizedDescription }
    }
}

private struct WebView: NSViewRepresentable {
    let web: WKWebView

    func makeNSView(context: Context) -> WKWebView { web }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
