import SwiftUI

/// The Brain process: start, stop, and its recent output.
struct LogsPane: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var brain: BrainProcess

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Text(brain.isRunning ? "Running (process \(String(brain.pid ?? 0)))" : app.settings.keepBrainRunning ? "Restarting" : "Stopped").font(.headline)
                Spacer()
                Button("Start") { app.startBrain() }.disabled(brain.isRunning).buttonStyle(.borderedProminent)
                Button("Stop") { app.stopBrain() }.disabled(!brain.isRunning && !app.settings.keepBrainRunning)
            }
            .padding(16)
            if let problem = app.startProblem {
                Label(problem, systemImage: "exclamationmark.triangle").foregroundStyle(coral).padding(.horizontal, 16).padding(.bottom, 12)
            }
            Divider()
            ScrollViewReader { proxy in
                ScrollView {
                    Text(brain.logs.isEmpty ? "No output yet." : brain.logs.joined(separator: "\n"))
                        .font(.system(.callout, design: .monospaced))
                        .foregroundStyle(brain.logs.isEmpty ? .secondary : .primary)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                        .id("end")
                }
                .onChange(of: brain.logs.count) { _, _ in proxy.scrollTo("end", anchor: .bottom) }
            }
            .background(Color(nsColor: .textBackgroundColor))
        }
    }
}

/// Where the Brain lives and how this app launches and reaches it.
struct SettingsPane: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var brain: BrainProcess
    @State private var showSecret = false

    var body: some View {
        Form {
            Section("Nous") {
                LabeledContent("Configuration file") {
                    HStack {
                        TextField("Configuration file", text: $app.settings.configPath, prompt: Text("/path/to/brain/data/nous/sophia.yaml")).labelsHidden()
                        Button("Choose…") { app.chooseConfigFile() }
                    }
                }
            }
            Section {
                TextField("Map address", text: $app.settings.mapURL, prompt: Text("https://noesiis.com/worldmap/orbital"))
            } header: {
                Text("Grid")
            } footer: {
                Text("The Portal page the Map screen opens.")
            }
            Section("Brain") {
                LabeledContent("Brain directory") {
                    HStack {
                        TextField("Brain directory", text: $app.settings.brainDir, prompt: Text("/path/to/Noesis/brain")).labelsHidden()
                        Button("Choose…") { app.chooseBrainDirectory() }
                    }
                }
                TextField("Python", text: $app.settings.pythonPath, prompt: Text(".venv/bin/python"))
                TextField("Local port", value: $app.settings.httpPort, format: .number.grouping(.never))
                LabeledContent("Extra environment") {
                    TextEditor(text: $app.settings.extraEnv)
                        .font(.system(.callout, design: .monospaced))
                        .frame(height: 70)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.25)))
                        .accessibilityLabel("Extra environment")
                }
                Text("One KEY=VALUE per line, for example GRID_URL or LLM_MODEL. Changes apply the next time the Brain starts.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Section("Local secret") {
                LabeledContent("Secret") {
                    HStack {
                        Text(showSecret ? app.secret : String(repeating: "•", count: 24))
                            .font(.system(.callout, design: .monospaced))
                            .textSelection(.enabled)
                            .lineLimit(1)
                            .truncationMode(.middle)
                        Button(showSecret ? "Hide" : "Show") { showSecret.toggle() }
                        Button("Make New") { app.regenerateSecret() }.disabled(brain.isRunning)
                    }
                }
                Text("This app made the secret and hands it to the Brain when it starts it, so only this app can read your Nous through the local port. It is kept in a file only you can read.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }
}
