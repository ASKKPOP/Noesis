import SwiftUI

/// Works: what you ask your Nous to do, and how it is going.
///
/// You set three things here — the goal, its definition and the plan (stages 2 to 4).
/// From Build on the Work is your Nous's: it builds, tests, deploys and announces, and
/// another Nous verifies. Those stages are shown as they happen and take no action here.
struct WorksPane: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var account: GridAccount
    @StateObject private var model = WorksModel()
    @State private var identity: GridIdentity?
    @State private var composing = false

    // Stage 2
    @State private var goal = ""
    @State private var forWhom = ""
    // Stage 3
    @State private var forWhat = ""
    @State private var how = ""
    @State private var which = ""
    @State private var checks = ""
    // Stage 4
    @State private var plan = [PlanDraft()]
    @State private var sending = false

    private var call: WorksModel.Call? {
        guard let grid = app.settings.grid else { return nil }
        let email = app.settings.accountEmail
        return { method, path, body in await account.call(method, path, body: body, email: email, grid: grid) }
    }

    var body: some View {
        HStack(spacing: 0) {
            list.frame(width: 270)
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if let problem = model.problem {
                        Label(problem, systemImage: "exclamationmark.triangle").foregroundStyle(coral)
                    }
                    if composing || (model.open == nil && model.works.isEmpty) {
                        newGoal
                    } else if let card = model.open {
                        detail(card)
                    } else {
                        Text("Choose a Work on the left, or state a new goal.").foregroundStyle(.secondary)
                    }
                }
                .padding(24)
                .frame(maxWidth: 760, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .task {
            identity = GridIdentity(settings: app.settings, nousName: app.nousName)
            // Monitoring: read the Works again every few seconds while this screen is open.
            while !Task.isCancelled {
                if let call { await model.refresh(call) }
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }

    // MARK: List

    private var list: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                composing = true
                model.close()
            } label: {
                Label("State a goal", systemImage: "plus").frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.borderless)
            .padding(12)
            Divider()
            if model.works.isEmpty {
                Text(model.loaded ? "No Works yet." : "Reading your Works…")
                    .foregroundStyle(.secondary).padding(12)
            }
            List(model.works, selection: Binding(
                get: { composing ? nil : model.open?.work_id },
                set: { id in
                    guard let id, let call else { return }
                    composing = false
                    Task { await model.show(id, call) }
                })) { work in
                VStack(alignment: .leading, spacing: 3) {
                    Text(work.goal).lineLimit(2)
                    Text(work.standing).font(.caption).foregroundStyle(work.stage == "done" ? .secondary : coral)
                }
                .padding(.vertical, 3)
                .tag(work.work_id)
            }
            .listStyle(.inset)
        }
    }

    // MARK: Stage 2 — goal

    private var newGoal: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("State a goal").font(.title2.weight(.semibold))
            Text("Say what you want to exist, in one sentence, and who it is for. Your Nous is asked to build it. It is a request: your Nous answers by itself and may decline.")
                .foregroundStyle(.secondary)
            field("Goal", text: $goal, prompt: "A short guide to the Grid's founding laws")
            field("For whom", text: $forWhom, prompt: "New residents")
            if let builder = identity?.civicDID {
                LabeledContent("Builder", value: "\(app.nousName) · \(shortDID(builder))")
                Button("Ask \(app.nousName)") { send { call in
                    if await model.stateGoal(goal: goal, forWhom: forWhom, builder: builder, call) {
                        goal = ""; forWhom = ""; composing = false
                    }
                } }
                .buttonStyle(.borderedProminent).tint(coral).disabled(sending || call == nil)
            } else {
                Label("Your Nous is not a citizen of this Grid yet, so it cannot be asked. See Grid Access.", systemImage: "person.badge.key")
                    .foregroundStyle(coral)
            }
        }
    }

    // MARK: One Work

    @ViewBuilder private func detail(_ card: WorkCard) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(card.goal).font(.title2.weight(.semibold)).textSelection(.enabled)
            Text("\(card.standing) · version \(card.version) · last change at tick \(card.updated_tick)")
                .font(.callout).foregroundStyle(.secondary)
            WorkTracker(card: card)
        }

        GroupBox("Your step") {
            VStack(alignment: .leading, spacing: 10) {
                if model.may.contains("define") { defineForm }
                if model.may.contains("set_plan") { planForm(card) }
                if model.may.contains("approve_plan"), !card.plan.isEmpty { approve(card) }
                if !["define", "set_plan", "approve_plan"].contains(where: model.may.contains) {
                    Text(card.waitingFor).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(6)
        }

        WorkMonitorView(card: card)
    }

    // MARK: Stage 3 — define

    private var defineForm: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Define the Work").font(.headline)
            Text("For what, how, and with which means. Then the checks that will prove it is done: your Nous cannot build until they are written.")
                .foregroundStyle(.secondary)
            field("For what", text: $forWhat)
            field("How", text: $how)
            area("Which — tools or means, one per line; may be empty", text: $which)
            area("Checks — one per line, at least one", text: $checks)
            Button("Save the definition") { send { call in
                if await model.write("define", ["for_what": forWhat, "how": how, "which": lines(which), "checks": lines(checks)], call) {
                    forWhat = ""; how = ""; which = ""; checks = ""
                }
            } }
            .buttonStyle(.borderedProminent).tint(coral).disabled(sending)
        }
    }

    // MARK: Stage 4 — plan

    private func planForm(_ card: WorkCard) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(card.plan.isEmpty ? "Write the plan" : "Replace the plan").font(.headline)
            Text("Ordered steps, each with the tick it is due by. Saving a plan clears an earlier approval.")
                .foregroundStyle(.secondary)
            ForEach($plan) { $row in
                HStack {
                    TextField("Step", text: $row.todo).textFieldStyle(.roundedBorder)
                    TextField("Due by tick", text: $row.dueBy).textFieldStyle(.roundedBorder).frame(width: 110)
                }
            }
            HStack {
                Button("Save the plan") { send { call in
                    if await model.write("plan", ["steps": PlanDraft.body(plan)], call) { plan = [PlanDraft()] }
                } }
                .buttonStyle(.borderedProminent).tint(coral).disabled(sending)
                Button("Add a step") { plan.append(PlanDraft()) }
            }
        }
    }

    private func approve(_ card: WorkCard) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Approve the plan").font(.headline)
            Text("You approve the \(card.plan.count)-step plan shown below once, not each action. After this your Nous starts building, and the rest is its own.")
                .foregroundStyle(.secondary)
            Button("Approve — start building") { send { call in _ = await model.write("plan/approve", [:], call) } }
                .buttonStyle(.borderedProminent).tint(coral).disabled(sending)
        }
    }

    // MARK: Pieces

    private func send(_ action: @escaping (WorksModel.Call) async -> Void) {
        guard let call, !sending else { return }
        sending = true
        Task {
            await action(call)
            sending = false
        }
    }

    private func field(_ title: String, text: Binding<String>, prompt: String = "") -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.callout.weight(.medium))
            TextField(title, text: text, prompt: Text(prompt)).textFieldStyle(.roundedBorder).labelsHidden()
        }
    }

    private func area(_ title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.callout.weight(.medium))
            TextEditor(text: text).font(.body).frame(height: 64)
                .overlay(RoundedRectangle(cornerRadius: 5).stroke(Color.secondary.opacity(0.3)))
        }
    }
}
