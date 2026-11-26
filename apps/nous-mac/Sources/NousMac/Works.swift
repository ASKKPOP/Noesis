import Foundation

/// A Work Card as the Grid serves it (grid/src/work/work-logic.ts): one record of a goal
/// on its way to a result. This app shows the record and sends the three steps a person
/// sets (goal, define, plan); every rule is the Grid's.
struct WorkCard: Codable, Identifiable, Equatable {
    struct Answer: Codable, Equatable { let accepted: Bool; let reason: String; let tick: Int }
    struct PlanStep: Codable, Equatable, Identifiable {
        let step: Int; let `do`: String; let by_tick: Int; let done: Bool; let done_tick: Int?; let note: String
        var id: Int { step }
    }
    struct CheckResult: Codable, Equatable { let passed: Bool; let evidence: String; let tick: Int }
    struct Said: Codable, Equatable { let by: String; let reason: String; let tick: Int }
    struct Outcome: Codable, Equatable {
        let `where`: String; let changed: String; let built_by: String; let verified_by: String
        let built_from: [String]; let tick: Int
    }
    struct Notice: Codable, Equatable {
        let goal_info: String; let guide: String; let presentation: String; let by: String; let tick: Int
    }

    let work_id: String
    let grid: String
    let stage: String
    let version: Int
    let goal: String
    let for_whom: String
    let owner: String
    let owner_kind: String
    let builder: String
    let answer: Answer?
    let for_what: String
    let how: String
    let which: [String]
    let checks: [String]
    let plan: [PlanStep]
    let plan_approved: Bool
    let results: [CheckResult?]
    let refusals: Int
    let last_refusal: Said?
    let verified: Said?
    let result: Outcome?
    let notice: Notice?
    let created_tick: Int
    let updated_tick: Int

    var id: String { work_id }

    /// The nine stages, in order, as they are named to a person.
    static let loop = ["Enter", "Goal", "Define", "Plan", "Build", "Test", "Verify", "Deploy", "Notice"]

    /// The number of the stage the Work is in now: 2…9, or 10 when it is done.
    var stageNumber: Int {
        switch stage {
        case "goal", "declined": return 2
        case "define": return 3
        case "plan": return 4
        case "build": return 5
        case "test": return 6
        case "verify": return 7
        case "deploy": return 8
        case "notice": return 9
        default: return 10
        }
    }

    /// Where the Work stands, in a line.
    var standing: String {
        switch stage {
        case "done": return "Done"
        case "declined": return "Declined by the Nous"
        default: return "Stage \(stageNumber) of 9 · \(Self.loop[stageNumber - 1])"
        }
    }

    var stepsDone: Int { plan.filter(\.done).count }

    /// What is being waited for, when no step is this person's to take.
    var waitingFor: String {
        switch stage {
        case "goal": return "Your Nous has been asked. It accepts or declines by itself."
        case "define": return "Waiting for the definition."
        case "plan": return "Waiting for a plan and its approval."
        case "build": return "Your Nous is doing the steps of the plan."
        case "test": return "Your Nous is running the checks."
        case "verify": return "Waiting for another Nous to verify the work."
        case "deploy": return "Verified. Your Nous records where the result lives."
        case "notice": return "Deployed. Your Nous writes the notice."
        case "done": return "This Work is finished."
        default: return "Your Nous declined. This Work is closed."
        }
    }
}

/// The Works this account owns on the Grid, the one that is open, and the writes a
/// person makes from this app: state a goal, define, plan, approve the plan.
@MainActor
final class WorksModel: ObservableObject {
    /// One request to the Grid as the signed-in account (GridAccount.call).
    typealias Call = (_ method: String, _ path: String, _ body: [String: Any]?) async -> (status: Int, json: [String: Any])?

    @Published private(set) var works: [WorkCard] = []
    @Published private(set) var open: WorkCard?
    /// The steps the Grid says are this account's to take on the open Work, now.
    @Published private(set) var may: [String] = []
    @Published private(set) var loaded = false
    @Published var problem: String?

    /// Read the Works this account owns, latest change first, and the open one again.
    func refresh(_ call: Call) async {
        guard let answer = await call("GET", "/api/v1/works?role=owner&limit=100", nil) else {
            problem = Self.noSession
            return
        }
        guard answer.status == 200, let list: [WorkCard] = Self.decode(answer.json["works"]) else {
            problem = Self.explain(answer.json["error"] as? String ?? "http_\(answer.status)")
            return
        }
        works = list
        loaded = true
        if let id = open?.work_id { await show(id, call) }
    }

    /// Open one Work: the card, and which steps are this account's.
    func show(_ id: String, _ call: Call) async {
        guard let answer = await call("GET", "/api/v1/works/\(id)", nil), answer.status == 200,
              let card: WorkCard = Self.decode(answer.json["work"]) else { return }
        open = card
        may = (answer.json["you"] as? [String: Any])?["may"] as? [String] ?? []
    }

    func close() {
        open = nil
        may = []
    }

    /// Stage 2: ask a Nous to build something. True when the Grid took it.
    func stateGoal(goal: String, forWhom: String, builder: String, _ call: Call) async -> Bool {
        let body: [String: Any] = ["goal": goal, "for_whom": forWhom, "builder": builder]
        guard let card = await send("/api/v1/works", body, call) else { return false }
        open = card
        may = []
        await refresh(call)
        return true
    }

    /// Stages 3 and 4: one write on the open Work, on the version shown.
    func write(_ step: String, _ fields: [String: Any], _ call: Call) async -> Bool {
        guard let card = open else { return false }
        var body = fields
        body["version"] = card.version
        let applied = await send("/api/v1/works/\(card.work_id)/\(step)", body, call) != nil
        // Applied or refused, show the card as the Grid has it now.
        await refresh(call)
        return applied
    }

    private func send(_ path: String, _ body: [String: Any], _ call: Call) async -> WorkCard? {
        problem = nil
        guard let answer = await call("POST", path, body) else {
            problem = Self.noSession
            return nil
        }
        guard (200..<300).contains(answer.status), let card: WorkCard = Self.decode(answer.json["work"]) else {
            problem = Self.explain(answer.json["error"] as? String ?? "http_\(answer.status)")
            return nil
        }
        return card
    }

    static let noSession = "The Grid could not be reached, or you are not signed in. See Grid Access."

    /// What a refusal means, in a sentence.
    static func explain(_ error: String) -> String {
        switch error {
        case "membership_required": return "Only members of this Grid can do this. Sign in under Grid Access with an account that has joined the Grid."
        case "not_member": return "Your Civic-DID in this Grid is not active."
        case "builder_must_be_nous": return "The builder must be a Nous that is a citizen of this Grid. Check your Nous's citizenship under Grid Access."
        case "stale_version": return "This Work changed since it was shown. It has been reloaded; check it and try again."
        case "wrong_stage": return "This Work has already moved on. It has been reloaded."
        case "not_allowed": return "This step belongs to someone else on this Work."
        case "unknown_work": return "This Work does not exist."
        default:
            if error.hasPrefix("invalid_") {
                return "Please check: \(error.dropFirst("invalid_".count).replacingOccurrences(of: "_", with: " "))."
            }
            return "The Grid refused: \(error)."
        }
    }

    private static func decode<T: Decodable>(_ value: Any?) -> T? {
        guard let value, JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
}

/// One plan step as it is typed: what to do, and the tick it is due by.
struct PlanDraft: Identifiable, Equatable {
    let id = UUID()
    var todo = ""
    var dueBy = ""

    /// The steps as the Grid takes them; empty rows are left out.
    static func body(_ rows: [PlanDraft]) -> [[String: Any]] {
        rows.filter { !$0.todo.trimmingCharacters(in: .whitespaces).isEmpty }
            .map { ["do": $0.todo, "by_tick": Int($0.dueBy.trimmingCharacters(in: .whitespaces)) ?? -1] }
    }
}

/// One entry per line, empty lines left out.
func lines(_ text: String) -> [String] {
    text.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
}
