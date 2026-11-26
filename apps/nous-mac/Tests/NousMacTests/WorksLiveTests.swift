import XCTest
@testable import NousMac

/// A live round against a running Grid, with the app's own account and Works code: the
/// person states a goal, defines it, plans and approves; then only watches while the Nous
/// does the rest. Skipped unless WORKS_LIVE_GRID is set (with WORKS_LIVE_EMAIL,
/// WORKS_LIVE_PASSWORD and WORKS_LIVE_BUILDER, the Civic-DID of a Nous whose Brain is running).
@MainActor
final class WorksLiveTests: XCTestCase {
    func testAPersonSetsAWorkUpAndWatchesTheNousFinishIt() async throws {
        let env = ProcessInfo.processInfo.environment
        guard let address = env["WORKS_LIVE_GRID"], let grid = URL(string: address),
              let email = env["WORKS_LIVE_EMAIL"], let password = env["WORKS_LIVE_PASSWORD"],
              let builder = env["WORKS_LIVE_BUILDER"] else {
            throw XCTSkip("WORKS_LIVE_GRID is not set")
        }
        let service = "com.noesiis.nous.tests.works-live"
        defer { Keychain.delete(account: "\(email)@\(grid.host ?? "")", service: service) }
        let account = GridAccount(service: service, install: { _ in }, remove: { _ in })
        let signedIn = await account.signIn(email: email, password: password, grid: grid)
        XCTAssertTrue(signedIn, "\(account.state)")
        let call: WorksModel.Call = { method, path, body in await account.call(method, path, body: body, email: email, grid: grid) }
        let model = WorksModel()

        // Stage 2 — the goal, from this app.
        let asked = await model.stateGoal(
            goal: "A three-sentence explanation of what a prime number is, with the first ten primes listed",
            forWhom: "newcomers who want a quick refresher", builder: builder, call)
        XCTAssertTrue(asked, model.problem ?? "")
        let id = try XCTUnwrap(model.open?.work_id)
        print("[live] stated the goal: \(id)")

        var seen = [String]()
        let deadline = Date().addingTimeInterval(Double(env["WORKS_LIVE_MINUTES"] ?? "25")! * 60)
        while Date() < deadline {
            await model.show(id, call)
            let card = try XCTUnwrap(model.open)
            if seen.last != card.stage {
                seen.append(card.stage)
                if let dir = env["WORKS_LIVE_OUT_DIR"], let answer = await call("GET", "/api/v1/works/\(id)", nil) {
                    // Keep the card as it stood at each stage, for a report.
                    let name = String(format: "%02d-%@.json", seen.count, card.stage)
                    try JSONSerialization.data(withJSONObject: answer.json["work"] ?? [:], options: [.prettyPrinted, .sortedKeys])
                        .write(to: URL(fileURLWithPath: dir).appendingPathComponent(name))
                }
                print("[live] \(card.standing) · version \(card.version) · this app may: \(model.may)")
            }
            if card.stage == "done" || card.stage == "declined" { break }
            // Stages 3 and 4 — the definition, the plan and its approval, from this app.
            if model.may.contains("define") {
                let ok = await model.write("define", [
                    "for_what": "Newcomers forget what a prime number is.",
                    "how": "List the first ten primes, then explain primes in three sentences.",
                    "which": [String](),
                    "checks": ["The list has exactly ten numbers and every one is prime", "The explanation has exactly three sentences"],
                ], call)
                XCTAssertTrue(ok, model.problem ?? "")
            } else if model.may.contains("set_plan"), card.plan.isEmpty {
                var rows = [PlanDraft(), PlanDraft()]
                rows[0].todo = "List the first ten prime numbers"; rows[0].dueBy = "100000"
                rows[1].todo = "Write the three-sentence explanation of what a prime number is"; rows[1].dueBy = "200000"
                let ok = await model.write("plan", ["steps": PlanDraft.body(rows)], call)
                XCTAssertTrue(ok, model.problem ?? "")
            } else if model.may.contains("approve_plan"), !card.plan.isEmpty {
                let ok = await model.write("plan/approve", [:], call)
                XCTAssertTrue(ok, model.problem ?? "")
            } else {
                // From Build on this app only watches: the Grid offers it no step.
                if card.stageNumber >= 5 { XCTAssertEqual(model.may, [], "the app was offered a step in \(card.stage)") }
                try await Task.sleep(for: .seconds(3))
            }
        }
        let card = try XCTUnwrap(model.open)
        if let out = env["WORKS_LIVE_OUT"] {
            let answer = await call("GET", "/api/v1/works/\(id)", nil)
            try JSONSerialization.data(withJSONObject: answer?.json["work"] ?? [:], options: [.prettyPrinted, .sortedKeys])
                .write(to: URL(fileURLWithPath: out))
        }
        print("[live] stages seen: \(seen.joined(separator: " → "))")
        XCTAssertEqual(card.stage, "done", "stopped at \(card.standing)")
        XCTAssertNotEqual(card.verified?.by, card.builder)
        XCTAssertEqual(card.notice?.by, builder)
    }
}
