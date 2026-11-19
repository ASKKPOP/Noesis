import SwiftUI

/// The local models this Nous can think with, and which one it uses.
struct LocalAIPane: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var brain: BrainProcess
    @State private var models: [LocalModels.Model] = []
    @State private var problem: String?
    @State private var loaded = false

    /// The Brain's own default when no model is chosen here.
    private static let brainDefault = "qwen3:4b"

    private var effectiveModel: String { app.settings.model.isEmpty ? Self.brainDefault : app.settings.model }
    private var effectiveInstalled: Bool { models.contains { $0.name == effectiveModel } }

    var body: some View {
        Form {
            Section {
                LabeledContent("In use", value: effectiveModel + (app.settings.model.isEmpty ? " (the Brain's default)" : ""))
                if loaded && problem == nil && !effectiveInstalled {
                    Label("\(effectiveModel) is not installed on this Mac, so the Nous cannot think with it. Choose an installed model below.",
                          systemImage: "exclamationmark.triangle")
                        .foregroundStyle(coral)
                        .fixedSize(horizontal: false, vertical: true)
                }
            } header: {
                Text("Thinking model")
            } footer: {
                if brain.isRunning { Text("A change applies the next time the Brain starts.") }
            }
            Section("Installed on this Mac") {
                if let problem {
                    Label(problem, systemImage: "exclamationmark.triangle").foregroundStyle(coral).fixedSize(horizontal: false, vertical: true)
                } else if !loaded {
                    ProgressView().controlSize(.small)
                } else if models.isEmpty {
                    Text("The model server is running but has no models. Install one with Ollama first.").foregroundStyle(.secondary)
                }
                ForEach(models) { model in
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(model.name)
                            Text([model.parameters, model.sizeBytes > 0 ? String(format: "%.1f GB", model.sizeBytes / 1e9) : ""]
                                .filter { !$0.isEmpty }.joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if model.name == effectiveModel {
                            Image(systemName: "checkmark").foregroundStyle(coral).accessibilityLabel("In use")
                        } else {
                            Button("Use") { app.settings.model = model.name }
                                .accessibilityLabel("Use \(model.name)")
                        }
                    }
                }
            }
            Section("Model server") {
                LabeledContent("Address") {
                    HStack {
                        TextField("Address", text: $app.settings.ollamaHost).labelsHidden()
                        Button("Refresh") { Task { await load() } }
                    }
                }
            }
            if brain.isRunning { BrainAIStatus() }
        }
        .formStyle(.grouped)
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
        .task { await load() }
    }

    private func load() async {
        do {
            models = try await LocalModels.installed(host: app.settings.ollamaHost)
            problem = nil
        } catch {
            models = []
            problem = error.localizedDescription
        }
        loaded = true
    }
}

/// What the running Brain itself reports about its model provider.
private struct BrainAIStatus: View {
    @EnvironmentObject private var app: AppModel
    @StateObject private var data = LiveData()

    var body: some View {
        Section("As the running Brain sees it") {
            if let status = data.value {
                ForEach(status.fields, id: \.key) { key, value in
                    LabeledContent(key.replacingOccurrences(of: "_", with: " ").capitalized, value: value.text.isEmpty ? "—" : value.text)
                }
            } else {
                Text(data.problem ?? "Asking the Brain…").foregroundStyle(.secondary)
            }
        }
        .task { await data.poll("/local-ai/status", every: 5) { app.api } }
    }
}
