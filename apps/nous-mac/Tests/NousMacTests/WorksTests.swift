import XCTest
@testable import NousMac

/// The Works screen's model against a stub Grid: what is read, what is sent for the three
/// steps a person sets, and what a refusal looks like. Nothing leaves this Mac.
@MainActor
final class WorksTests: XCTestCase {
    private let grid = URL(string: "https://grid.test")!
    private let service = "com.noesiis.nous.tests.works"
    private let email = "tester@grid.test"
    private let me = "did:civic:noesis:human:ada"
    private let sophia = "did:civic:noesis:sophia"
    private let id = "00000000-0000-4000-8000-000000000001"

    private func card(stage: String, version: Int, plan: Bool = false) -> [String: Any] {
        [
            "work_id": id, "grid": "genesis", "stage": stage, "version": version, "goal": "A guide", "for_whom": "new residents",
            "owner": me, "owner_kind": "person", "builder": sophia,
            "answer": ["accepted": true, "reason": "yes", "tick": 2],
            "for_what": "a", "how": "b", "which": ["tool:web_fetch"], "checks": ["c1", "c2"],
            "plan": plan ? [["step": 1, "do": "read", "by_tick": 100, "done": true, "done_tick": 40, "note": "read all"],
                            ["step": 2, "do": "write", "by_tick": 200, "done": false, "done_tick": NSNull(), "note": ""]] : [],
            "plan_approved": plan, "results": [["passed": true, "evidence": "seen", "tick": 50], NSNull()],
            "refusals": 0, "last_refusal": NSNull(), "verified": NSNull(), "result": NSNull(), "notice": NSNull(),
            "created_tick": 1, "updated_tick": 50,
        ]
    }

    private func json(_ object: [String: Any]) -> Data { try! JSONSerialization.data(withJSONObject: object) }
    private func sent(_ request: URLRequest) -> [String: Any] {
        guard let stream = request.httpBodyStream else { return [:] }
        stream.open(); defer { stream.close() }
        var data = Data(); var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable { let n = stream.read(&buffer, maxLength: buffer.count); if n <= 0 { break }; data.append(buffer, count: n) }
        return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    /// A signed-in account whose requests go to StubGrid, and the call the screen uses.
    private func signedIn() async -> WorksModel.Call {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubGrid.self]
        let account = GridAccount(session: URLSession(configuration: config), service: service, install: { _ in }, remove: { _ in })
        StubGrid.answer = { _ in
            (200, ["Set-Cookie": "noesis_portal_token=tok123; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400"],
             Data(#"{"did":"did:noesis:human:abc"}"#.utf8))
        }
        let ok = await account.signIn(email: email, password: "a-test-password", grid: grid)
        XCTAssertTrue(ok)
        StubGrid.requests = []
        let (email, grid) = (self.email, self.grid)
        return { method, path, body in await account.call(method, path, body: body, email: email, grid: grid) }
    }

    override func setUp() async throws { Keychain.delete(account: "\(email)@grid.test", service: service) }
    override func tearDown() async throws { Keychain.delete(account: "\(email)@grid.test", service: service) }

    func testACardFromTheGridIsReadWhole() async throws {
        let data = json(card(stage: "test", version: 9, plan: true))
        let work = try JSONDecoder().decode(WorkCard.self, from: data)
        XCTAssertEqual(work.stageNumber, 6)
        XCTAssertEqual(work.standing, "Stage 6 of 9 · Test")
        XCTAssertEqual(work.stepsDone, 1)
        XCTAssertEqual(work.plan[1].do, "write")
        XCTAssertNil(work.plan[1].done_tick)
        XCTAssertEqual(work.results.count, 2)
        XCTAssertEqual(work.results[0]?.evidence, "seen")
        XCTAssertNil(work.results[1])
        XCTAssertNil(work.verified)
    }

    func testEveryStageHasANumberAndAWaitingLine() throws {
        let numbers = ["goal": 2, "define": 3, "plan": 4, "build": 5, "test": 6, "verify": 7, "deploy": 8, "notice": 9, "done": 10, "declined": 2]
        for (stage, number) in numbers {
            let work = try JSONDecoder().decode(WorkCard.self, from: json(card(stage: stage, version: 1)))
            XCTAssertEqual(work.stageNumber, number, stage)
            XCTAssertFalse(work.waitingFor.isEmpty, stage)
        }
        XCTAssertEqual(WorkCard.loop.count, 9)
    }

    func testItReadsTheWorksThisAccountOwnsWithItsSession() async {
        let call = await signedIn()
        let list = json(["works": [card(stage: "build", version: 5, plan: true)], "count": 1])
        StubGrid.answer = { _ in (200, [:], list) }
        let model = WorksModel()
        await model.refresh(call)
        XCTAssertEqual(model.works.map(\.work_id), [id])
        XCTAssertTrue(model.loaded)
        XCTAssertNil(model.problem)
        let request = StubGrid.requests[0]
        XCTAssertEqual(request.url?.absoluteString, "https://grid.test/api/v1/works?role=owner&limit=100")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Cookie"), "noesis_portal_token=tok123")
    }

    func testStatingAGoalNamesTheNousAsBuilder() async {
        let call = await signedIn()
        let made = json(["work": card(stage: "goal", version: 1)])
        let list = json(["works": [card(stage: "goal", version: 1)]])
        StubGrid.answer = { $0.httpMethod == "POST" ? (201, [:], made) : (200, [:], list) }
        let model = WorksModel()
        let ok = await model.stateGoal(goal: "A guide", forWhom: "new residents", builder: sophia, call)
        XCTAssertTrue(ok)
        XCTAssertEqual(model.open?.stage, "goal")
        let post = StubGrid.requests.first { $0.httpMethod == "POST" }!
        XCTAssertEqual(post.url?.path, "/api/v1/works")
        XCTAssertEqual(sent(post) as NSDictionary, ["goal": "A guide", "for_whom": "new residents", "builder": sophia] as NSDictionary)
    }

    func testDefineAndPlanAreSentOnTheVersionShown() async {
        let call = await signedIn()
        var stored = card(stage: "define", version: 2)
        let me = self.me
        StubGrid.answer = { request in
            if request.httpMethod == "POST" { return (200, [:], try! JSONSerialization.data(withJSONObject: ["work": stored])) }
            if request.url!.path.hasSuffix("/works") { return (200, [:], try! JSONSerialization.data(withJSONObject: ["works": [stored]])) }
            let may = stored["stage"] as? String == "define" ? ["define"] : ["set_plan", "approve_plan"]
            return (200, [:], try! JSONSerialization.data(withJSONObject: ["work": stored, "you": ["civic_did": me, "kind": "person", "may": may]]))
        }
        let model = WorksModel()
        await model.show(id, call)
        XCTAssertEqual(model.may, ["define"])

        stored = card(stage: "plan", version: 3)
        var ok = await model.write("define", ["for_what": "a", "how": "b", "which": lines("x\n\n y "), "checks": lines("c1\nc2")], call)
        XCTAssertTrue(ok)
        var post = StubGrid.requests.last { $0.httpMethod == "POST" }!
        XCTAssertEqual(post.url?.path, "/api/v1/works/\(id)/define")
        XCTAssertEqual(sent(post) as NSDictionary, ["version": 2, "for_what": "a", "how": "b", "which": ["x", "y"], "checks": ["c1", "c2"]] as NSDictionary)
        XCTAssertEqual(model.open?.version, 3)
        XCTAssertEqual(model.may, ["set_plan", "approve_plan"])

        var rows = [PlanDraft(), PlanDraft(), PlanDraft()]
        rows[0].todo = "read"; rows[0].dueBy = "100"
        rows[2].todo = "write"; rows[2].dueBy = " 200 "
        ok = await model.write("plan", ["steps": PlanDraft.body(rows)], call)
        XCTAssertTrue(ok)
        post = StubGrid.requests.last { $0.httpMethod == "POST" }!
        XCTAssertEqual(post.url?.path, "/api/v1/works/\(id)/plan")
        XCTAssertEqual(sent(post) as NSDictionary, ["version": 3, "steps": [["do": "read", "by_tick": 100], ["do": "write", "by_tick": 200]]] as NSDictionary)

        ok = await model.write("plan/approve", [:], call)
        post = StubGrid.requests.last { $0.httpMethod == "POST" }!
        XCTAssertEqual(post.url?.path, "/api/v1/works/\(id)/plan/approve")
        XCTAssertEqual(sent(post) as NSDictionary, ["version": 3] as NSDictionary)
    }

    func testARefusalIsExplainedAndTheCardIsReadAgain() async {
        let call = await signedIn()
        let shown = card(stage: "plan", version: 4, plan: true)
        StubGrid.answer = { request in
            if request.httpMethod == "POST" { return (409, [:], Data(#"{"error":"stale_version","version":5}"#.utf8)) }
            if request.url!.path.hasSuffix("/works") { return (200, [:], try! JSONSerialization.data(withJSONObject: ["works": [shown]])) }
            return (200, [:], try! JSONSerialization.data(withJSONObject: ["work": shown, "you": ["may": ["approve_plan"]]]))
        }
        let model = WorksModel()
        await model.show(id, call)
        StubGrid.requests = []
        let ok = await model.write("plan/approve", [:], call)
        XCTAssertFalse(ok)
        XCTAssertEqual(model.problem, WorksModel.explain("stale_version"))
        XCTAssertTrue(StubGrid.requests.contains { $0.httpMethod == "GET" && $0.url!.path.hasSuffix("/works/\(id)") })
    }

    func testWithoutASessionNothingIsSent() async {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubGrid.self]
        let account = GridAccount(session: URLSession(configuration: config), service: service, install: { _ in }, remove: { _ in })
        StubGrid.requests = []
        let (email, grid) = (self.email, self.grid)
        let model = WorksModel()
        await model.refresh { method, path, body in await account.call(method, path, body: body, email: email, grid: grid) }
        XCTAssertEqual(model.problem, WorksModel.noSession)
        XCTAssertTrue(StubGrid.requests.isEmpty)
        XCTAssertFalse(model.loaded)
    }

    func testRefusalsReadAsSentences() {
        for error in ["membership_required", "not_member", "builder_must_be_nous", "stale_version", "wrong_stage", "not_allowed", "unknown_work", "invalid_checks"] {
            XCTAssertFalse(WorksModel.explain(error).contains("_"), error)
        }
        XCTAssertEqual(WorksModel.explain("something_new"), "The Grid refused: something_new.")
        XCTAssertEqual(WorksModel.explain("invalid_for_what"), "Please check: for what.")
    }
}
