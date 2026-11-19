import SwiftUI

/// Home: the Nous at a glance — whether it is running, what it thinks with, how it is, and
/// what it is doing. Identity comes from the Rust core; the rest from the running Brain.
struct DashboardPane: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var brain: BrainProcess
    @EnvironmentObject private var viewer: ViewerModel
    @StateObject private var state = LiveData()
    @StateObject private var memory = LiveData()
    @State private var models: [LocalModels.Model]?

    private let columns = [GridItem(.adaptive(minimum: 300), spacing: 16, alignment: .top)]
    private var model: String { app.settings.model.isEmpty ? "qwen3:4b" : app.settings.model }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                LazyVGrid(columns: columns, alignment: .leading, spacing: 16) {
                    brainCard
                    modelCard
                    if let s = state.value, brain.isRunning {
                        Card(title: "Right now") {
                            KeyValue(key: "Mood", value: s["mood"].text)
                            KeyValue(key: "Location", value: s["location"].text)
                            KeyValue(key: "Grid", value: s["grid_name"].text)
                            KeyValue(key: "Deeds done", value: s["praxis"]["total_deeds"].text)
                            KeyValue(key: "Percepts", value: s["aisthesis"]["percept_count"].text)
                        }
                        Card(title: "Pursuing") {
                            if s["active_goals"].items.isEmpty { Text("No active goals.").foregroundStyle(.secondary) }
                            ForEach(Array(s["active_goals"].items.prefix(5).enumerated()), id: \.offset) { _, goal in
                                Text("• " + goal.text)
                            }
                            more(s["active_goals"].items.count - 5, pane: .overview)
                        }
                        Card(title: "Latest memories") {
                            let rows = memory.value?["memories"].items ?? []
                            if rows.isEmpty { Text("No memories yet.").foregroundStyle(.secondary) }
                            ForEach(Array(rows.prefix(4).enumerated()), id: \.offset) { _, m in
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(m["content"].text).lineLimit(2)
                                    Text("tick \(m["tick"].text) · \(m["memory_type"].text)").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            Button("All memories") { app.pane = .memory }.buttonStyle(.link)
                        }
                    } else if let view = viewer.view {
                        Card(title: "Goals it will start with") {
                            ForEach(view.goals.prefix(5)) { Text("• " + $0.description) }
                            more(view.goals.count - 5, pane: .profile)
                        }
                    }
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .task(id: brain.isRunning) {
            guard brain.isRunning else { state.clear(); memory.clear(); return }
            async let a: Void = state.poll("/local/state", every: 3) { app.api }
            async let b: Void = memory.poll("/local/memory/recent?limit=4", every: 6) { app.api }
            _ = await (a, b)
        }
        .task(id: app.settings.ollamaHost) { models = try? await LocalModels.installed(host: app.settings.ollamaHost) }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
                Text(app.nousName).font(.system(size: 34, weight: .semibold))
                if let view = viewer.view {
                    Text([view.archetype, "speaks \(view.communicationStyle)", "values \(view.values.prefix(3).joined(separator: ", "))"]
                        .filter { !$0.isEmpty }.joined(separator: " · "))
                        .foregroundStyle(.secondary)
                } else {
                    Text(viewer.problem ?? "No Nous configuration chosen yet.").foregroundStyle(.secondary)
                }
            }
            Spacer()
            if viewer.view == nil {
                Button("Choose Nous Configuration…") { app.chooseConfigFile() }.buttonStyle(.borderedProminent)
            } else {
                Button { app.pane = .chat } label: { Label("Talk", systemImage: "bubble.left.and.bubble.right") }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
            }
        }
    }

    private var brainCard: some View {
        Card(title: "Brain") {
            HStack(spacing: 8) {
                Circle().fill(brain.isRunning ? Color.green : Color.secondary.opacity(0.5)).frame(width: 9, height: 9)
                Text(brain.isRunning ? "Running" : app.settings.keepBrainRunning ? "Restarting" : "Stopped").font(.title3.weight(.medium))
                Spacer()
                if brain.isRunning || app.settings.keepBrainRunning {
                    Button("Stop") { app.stopBrain() }
                } else {
                    Button("Start") { app.startBrain() }.buttonStyle(.borderedProminent)
                }
            }
            if brain.isRunning, state.value == nil {
                Text(state.problem == nil ? "Waking up…" : "Started, not answering yet.").font(.callout).foregroundStyle(.secondary)
            }
            if let problem = app.startProblem {
                Text(problem).font(.callout).foregroundStyle(coral).fixedSize(horizontal: false, vertical: true)
            }
            Button("Process and logs") { app.pane = .logs }.buttonStyle(.link)
        }
    }

    private var modelCard: some View {
        Card(title: "Thinks with") {
            Text(model).font(.title3.weight(.medium))
            if let models {
                if models.contains(where: { $0.name == model }) {
                    Text("Installed on this Mac. Runs locally.").font(.callout).foregroundStyle(.secondary)
                } else {
                    Label("Not installed on this Mac — the Nous cannot think until you choose an installed model.",
                          systemImage: "exclamationmark.triangle")
                        .font(.callout)
                        .foregroundStyle(coral)
                        .fixedSize(horizontal: false, vertical: true)
                }
            } else {
                Text("The local model server is not answering.").font(.callout).foregroundStyle(coral)
            }
            Button("Local AI") { app.pane = .localAI }.buttonStyle(.link)
        }
    }

    @ViewBuilder private func more(_ count: Int, pane: Pane) -> some View {
        if count > 0 {
            Button("\(count) more") { app.pane = pane }.buttonStyle(.link)
        }
    }
}
