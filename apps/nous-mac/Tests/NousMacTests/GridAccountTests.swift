import XCTest
@testable import NousMac

/// Answers the app's requests in place of a Grid, so nothing leaves this Mac.
final class StubGrid: URLProtocol {
    nonisolated(unsafe) static var answer: (URLRequest) -> (Int, [String: String], Data) = { _ in (500, [:], Data()) }
    nonisolated(unsafe) static var requests: [URLRequest] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.requests.append(request)
        let (status, headers, body) = Self.answer(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@MainActor
final class GridAccountTests: XCTestCase {
    private let grid = URL(string: "https://grid.test")!
    private let service = "com.noesiis.nous.tests"
    private let email = "tester@grid.test"
    private var installed: [HTTPCookie] = []
    private var removed: [String] = []

    private func account() -> GridAccount {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubGrid.self]
        return GridAccount(session: URLSession(configuration: config), service: service,
                           install: { self.installed.append($0) }, remove: { self.removed.append($0) })
    }

    private static let accepted: (URLRequest) -> (Int, [String: String], Data) = { _ in
        (200, ["Set-Cookie": "noesis_portal_token=tok123; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400"],
         Data(#"{"did":"did:noesis:human:abc","is_new":false}"#.utf8))
    }

    override func setUp() async throws {
        StubGrid.requests = []
        Keychain.delete(account: "\(email)@grid.test", service: service)
    }

    override func tearDown() async throws {
        Keychain.delete(account: "\(email)@grid.test", service: service)
    }

    func testSignInStoresThePasswordAndHandsTheSessionToTheWebView() async {
        StubGrid.answer = Self.accepted
        let account = account()
        let worked = await account.signIn(email: email, password: "test-pass", grid: grid)
        XCTAssertTrue(worked)
        XCTAssertEqual(account.state, .signedIn(did: "did:noesis:human:abc"))
        XCTAssertEqual(installed.map(\.value), ["tok123"])
        XCTAssertEqual(Keychain.read(account: "\(email)@grid.test", service: service), "test-pass")
        XCTAssertEqual(StubGrid.requests.first?.url?.path, "/api/v1/portal/auth/email/signin")
    }

    func testAWrongPasswordIsNotStored() async {
        StubGrid.answer = { _ in (401, [:], Data(#"{"error":"invalid_credentials"}"#.utf8)) }
        let account = account()
        let worked = await account.signIn(email: email, password: "wrong", grid: grid)
        XCTAssertFalse(worked)
        XCTAssertEqual(account.state, .failed("The email or password is not right."))
        XCTAssertNil(Keychain.read(account: "\(email)@grid.test", service: service))
        XCTAssertTrue(installed.isEmpty)
    }

    func testRestoreSignsInWithTheStoredPasswordAndOnlyWhenNeeded() async {
        StubGrid.answer = Self.accepted
        let first = account()
        await first.signIn(email: email, password: "test-pass", grid: grid)

        // A new launch: nothing in memory, the password in the Keychain.
        StubGrid.requests = []
        let later = account()
        await later.restore(email: email, grid: grid)
        XCTAssertEqual(later.state, .signedIn(did: "did:noesis:human:abc"))
        XCTAssertEqual(StubGrid.requests.count, 1)

        // The session is fresh, so asking again sends nothing.
        await later.restore(email: email, grid: grid)
        XCTAssertEqual(StubGrid.requests.count, 1)
    }

    func testRestoreWithNothingStoredStaysSignedOut() async {
        let account = account()
        await account.restore(email: email, grid: grid)
        XCTAssertEqual(account.state, .signedOut)
        XCTAssertTrue(StubGrid.requests.isEmpty)
    }

    func testSignOutForgetsThePasswordAndTheSession() async {
        StubGrid.answer = Self.accepted
        let account = account()
        await account.signIn(email: email, password: "test-pass", grid: grid)
        StubGrid.answer = { _ in (200, [:], Data(#"{"ok":true}"#.utf8)) }
        await account.signOut(email: email, grid: grid)
        XCTAssertEqual(account.state, .signedOut)
        XCTAssertNil(Keychain.read(account: "\(email)@grid.test", service: service))
        XCTAssertEqual(removed, ["noesis_portal_token"])
    }
}
