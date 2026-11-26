import Foundation
import Security
import WebKit

/// Passwords in the Mac's Keychain. Nothing here is ever written to the settings file or a log.
enum Keychain {
    static func save(_ password: String, account: String, service: String) -> Bool {
        delete(account: account, service: service)
        let item: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword, kSecAttrService: service, kSecAttrAccount: account,
            kSecValueData: Data(password.utf8),
        ]
        return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
    }

    static func read(account: String, service: String) -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword, kSecAttrService: service, kSecAttrAccount: account,
            kSecReturnData: true, kSecMatchLimit: kSecMatchLimitOne,
        ]
        var found: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &found) == errSecSuccess, let data = found as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(account: String, service: String) {
        let query: [CFString: Any] = [kSecClass: kSecClassGenericPassword, kSecAttrService: service, kSecAttrAccount: account]
        SecItemDelete(query as CFDictionary)
    }
}

/// The human's account on a Grid's Portal. Sign in once here; the password is kept in the
/// Keychain and the app signs in again by itself whenever the Portal's session (24 hours)
/// has run out, so the Map and every Portal page open already signed in.
@MainActor
final class GridAccount: ObservableObject {
    enum State: Equatable {
        case signedOut
        case signingIn
        case signedIn(did: String)
        case failed(String)
    }

    /// The Portal's session cookie (COOKIE_NAME in grid/src/api/portal/auth.ts).
    static let cookieName = "noesis_portal_token"
    /// Sign in again once a session is this old; the Portal ends it at 24 hours.
    static let renewAfter: TimeInterval = 20 * 60 * 60

    @Published private(set) var state = State.signedOut
    private var signedInAt: Date?
    /// The session, kept to sign this app's own requests to the Grid.
    private var sessionCookie: HTTPCookie?

    private let session: URLSession
    private let service: String
    private let install: (HTTPCookie) async -> Void
    private let remove: (String) async -> Void

    /// The defaults are the real ones; tests pass their own.
    init(session: URLSession = URLSession(configuration: .ephemeral),
         service: String = "com.noesiis.nous.grid-account",
         install: ((HTTPCookie) async -> Void)? = nil,
         remove: ((String) async -> Void)? = nil) {
        self.session = session
        self.service = service
        let store = { WKWebsiteDataStore.default().httpCookieStore }
        self.install = install ?? { await store().setCookie($0) }
        self.remove = remove ?? { name in
            for cookie in await store().allCookies() where cookie.name == name { await store().deleteCookie(cookie) }
        }
    }

    /// Sign in with an email and password. On success the password goes to the Keychain
    /// and the session cookie to the app's web view. Returns whether it worked.
    @discardableResult
    func signIn(email: String, password: String, grid: URL) async -> Bool {
        state = .signingIn
        var request = URLRequest(url: grid.appendingPathComponent("api/v1/portal/auth/email/signin"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { return fail("The Grid gave no answer.") }
            guard http.statusCode == 200 else { return fail(Self.reason(http.statusCode)) }
            let fields = http.allHeaderFields.reduce(into: [String: String]()) { $0["\($1.key)"] = "\($1.value)" }
            guard let cookie = HTTPCookie.cookies(withResponseHeaderFields: fields, for: grid).first(where: { $0.name == Self.cookieName }),
                  let did = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["did"] as? String else {
                return fail("The Grid's answer could not be read.")
            }
            guard Keychain.save(password, account: Self.key(email, grid), service: service) else {
                return fail("The password could not be saved in the Keychain.")
            }
            await install(cookie)
            sessionCookie = cookie
            signedInAt = Date()
            state = .signedIn(did: did)
            return true
        } catch {
            return fail(error.localizedDescription)
        }
    }

    /// Sign in with the stored password when there is no session, or it is about to run out.
    func restore(email: String, grid: URL) async {
        if case .signingIn = state { return }
        if case .signedIn = state, let signedInAt, Date().timeIntervalSince(signedInAt) < Self.renewAfter { return }
        guard !email.isEmpty, let password = Keychain.read(account: Self.key(email, grid), service: service) else { return }
        await signIn(email: email, password: password, grid: grid)
    }

    /// Forget the stored password and end the session.
    func signOut(email: String, grid: URL) async {
        Keychain.delete(account: Self.key(email, grid), service: service)
        var request = URLRequest(url: grid.appendingPathComponent("api/v1/portal/auth/logout"))
        request.httpMethod = "POST"
        _ = try? await session.data(for: request)
        await remove(Self.cookieName)
        sessionCookie = nil
        signedInAt = nil
        state = .signedOut
    }

    /// What the Grid can email the account about its Local Nous (grid/src/api/portal/nous-alert.ts).
    enum Alert: String { case brainDown = "brain_down", localAIDown = "local_ai_down" }

    /// Ask the Grid to email this account that its Nous cannot stay running. The Grid
    /// writes the mail and sends it only to the account's own address. Returns nil when
    /// the mail went out (or one already did this hour), else why it did not.
    func emailAlert(_ alert: Alert, nous: String, email: String, grid: URL) async -> String? {
        await restore(email: email, grid: grid)
        guard case .signedIn = state, let sessionCookie else {
            return "No email was sent: sign in under Grid Access to get these alerts by email too."
        }
        var request = URLRequest(url: grid.appendingPathComponent("api/v1/portal/nous-alert"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("\(sessionCookie.name)=\(sessionCookie.value)", forHTTPHeaderField: "Cookie")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["kind": alert.rawValue, "nous": nous])
        guard let (_, response) = try? await session.data(for: request), let http = response as? HTTPURLResponse else {
            return "No email was sent: the Grid could not be reached."
        }
        switch http.statusCode {
        case 200, 429: return nil
        case 401: return "No email was sent: the Grid did not accept this sign-in."
        case 409: return "No email was sent: this account has no email address."
        case 503: return "No email was sent: the Grid has no mail service set up yet."
        default: return "No email was sent: the Grid answered with an error (\(http.statusCode))."
        }
    }

    /// One request to the Grid as the signed-in account: the status and the JSON object
    /// it answered with. Nil when there is no session or the Grid gave no answer.
    func call(_ method: String, _ path: String, body: [String: Any]? = nil,
              email: String, grid: URL) async -> (status: Int, json: [String: Any])? {
        await restore(email: email, grid: grid)
        guard case .signedIn = state, let sessionCookie else { return nil }
        let base = grid.absoluteString.hasSuffix("/") ? String(grid.absoluteString.dropLast()) : grid.absoluteString
        guard let url = URL(string: base + path) else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("\(sessionCookie.name)=\(sessionCookie.value)", forHTTPHeaderField: "Cookie")
        if method != "GET" {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONSerialization.data(withJSONObject: body ?? [:])
        }
        guard let (data, response) = try? await session.data(for: request), let http = response as? HTTPURLResponse else { return nil }
        let json = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
        return (http.statusCode, json)
    }

    /// One stored password per account per Grid.
    private static func key(_ email: String, _ grid: URL) -> String { "\(email)@\(grid.host ?? grid.absoluteString)" }

    private func fail(_ message: String) -> Bool {
        state = .failed(message)
        return false
    }

    private static func reason(_ status: Int) -> String {
        switch status {
        case 401: return "The email or password is not right."
        case 400: return "The Grid did not accept the request."
        case 503: return "The Grid's account service is not available right now."
        default: return "The Grid answered with an error (\(status))."
        }
    }
}
