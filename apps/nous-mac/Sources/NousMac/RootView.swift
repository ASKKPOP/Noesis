import SwiftUI

struct RootView: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var brain: BrainProcess

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                NousHeader()
                List(selection: Binding(get: { app.pane }, set: { if let pane = $0 { app.pane = pane } })) {
                    Section {
                        row(.dashboard)
                        row(.chat)
                    }
                    Section("Grid") {
                        row(.map)
                    }
                    Section("This Nous") {
                        row(.profile)
                        row(.overview)
                        row(.memory)
                        row(.wiki)
                    }
                    Section("Machine") {
                        row(.localAI)
                        row(.logs)
                        row(.config)
                    }
                }
                .listStyle(.sidebar)
                Divider()
                Button { app.pane = .settings } label: {
                    Label(Pane.settings.title, systemImage: Pane.settings.symbol)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .foregroundStyle(app.pane == .settings ? coral : .primary)
            }
            .navigationSplitViewColumnWidth(min: 210, ideal: 230, max: 280)
        } detail: {
            detail
                .navigationTitle(app.pane.title)
                .navigationSubtitle(app.nousName)
        }
    }

    private func row(_ pane: Pane) -> some View {
        Label(pane.title, systemImage: pane.symbol).tag(pane)
    }

    @ViewBuilder private var detail: some View {
        switch app.pane {
        case .dashboard: DashboardPane()
        case .chat: ChatPane()
        case .map: MapPane()
        case .profile: ProfilePane()
        case .overview: OverviewPane()
        case .memory: MemoryPane()
        case .wiki: WikiPane()
        case .localAI: LocalAIPane()
        case .logs: LogsPane()
        case .config: ConfigPane()
        case .settings: SettingsPane()
        }
    }
}

/// The Nous this app manages, whether its Brain is running, and the switch for it.
private struct NousHeader: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var brain: BrainProcess

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(app.nousName).font(.system(size: 22, weight: .semibold))
            HStack(spacing: 6) {
                Circle().fill(brain.isRunning ? Color.green : Color.secondary.opacity(0.5)).frame(width: 8, height: 8)
                Text(brain.isRunning ? "Brain running" : "Brain stopped").font(.callout).foregroundStyle(.secondary)
                Spacer()
                if brain.isRunning {
                    Button("Stop") { brain.stop() }.controlSize(.small)
                } else {
                    Button("Start") { app.startBrain() }.controlSize(.small).buttonStyle(.borderedProminent)
                }
            }
            if let problem = app.startProblem {
                Text(problem).font(.caption).foregroundStyle(coral).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(16)
    }
}

/// A screen's standard states: a problem, nothing yet, or content.
struct Notice: View {
    let symbol: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: symbol).font(.system(size: 36)).foregroundStyle(.secondary)
            Text(title).font(.title3.weight(.semibold))
            Text(message).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: 440).textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(40)
    }
}

struct Card<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.secondary.opacity(0.15)))
    }
}

struct KeyValue: View {
    let key: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(key).foregroundStyle(.secondary).frame(width: 120, alignment: .leading)
            Text(value.isEmpty ? "—" : value).textSelection(.enabled)
            Spacer(minLength: 0)
        }
    }
}
