import SwiftUI

/// The Brain process: start, stop, and its recent output.
struct LogsPane: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var brain: BrainProcess

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Text(brain.isRunning ? "Running (process \(String(brain.pid ?? 0)))" : "Stopped").font(.headline)
                Spacer()
                Button("Start") { app.startBrain() }.disabled(brain.isRunning).buttonStyle(.borderedProminent)
                Button("Stop") { brain.stop() }.disabled(!brain.isRunning)
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

/// Edit the Nous's configuration file. The Rust core checks the text as you type; a file
/// it cannot read as a Nous cannot be saved.
struct ConfigPane: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var brain: BrainProcess
    @State private var text = ""
    @State private var saved = ""
    @State private var note: String?

    private var path: String { app.settings.configPath }

    private var problem: String? {
        do {
            _ = try BrainCore.view(yaml: text, tick: 0)
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    var body: some View {
        if path.isEmpty {
            VStack(spacing: 14) {
                Notice(symbol: "doc.badge.plus", title: "No configuration chosen",
                       message: "Choose the YAML file that describes your Nous.")
                    .frame(maxHeight: 220)
                Button("Choose Nous Configuration…") { app.chooseConfigFile() }.buttonStyle(.borderedProminent)
                Spacer()
            }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text((path as NSString).lastPathComponent).font(.headline)
                        Text(path).font(.caption).foregroundStyle(.secondary).lineLimit(1).truncationMode(.middle)
                    }
                    Spacer()
                    Button("Choose Another…") { app.chooseConfigFile() }
                    Button("Revert") { load() }.disabled(text == saved)
                    Button("Save") { save() }.buttonStyle(.borderedProminent).disabled(text == saved || problem != nil)
                        .keyboardShortcut("s")
                }
                .padding(16)
                Group {
                    if let problem {
                        Label(problem, systemImage: "exclamationmark.triangle").foregroundStyle(coral)
                    } else if let note {
                        Text(note).foregroundStyle(.secondary)
                    } else {
                        Text(text == saved ? "No unsaved changes." : "Unsaved changes.").foregroundStyle(.secondary)
                    }
                }
                .font(.callout)
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
                Divider()
                TextEditor(text: $text)
                    .font(.system(.body, design: .monospaced))
                    .autocorrectionDisabled()
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .background(Color(nsColor: .textBackgroundColor))
                    .accessibilityLabel("Configuration text")
            }
            .onAppear(perform: load)
            .onChange(of: path) { _, _ in load() }
            .onChange(of: text) { _, _ in note = nil }
        }
    }

    private func load() {
        do {
            saved = try String(contentsOfFile: path, encoding: .utf8)
            text = saved
            note = nil
        } catch {
            saved = ""
            text = ""
            note = "Could not read the file: \(error.localizedDescription)"
        }
    }

    /// Keep the previous version beside the file, then write.
    private func save() {
        do {
            let backup = path + ".bak"
            try? FileManager.default.removeItem(atPath: backup)
            try FileManager.default.copyItem(atPath: path, toPath: backup)
            try text.write(toFile: path, atomically: true, encoding: .utf8)
            saved = text
            app.viewer.load(path: path)
            note = "Saved. The previous version is at \((backup as NSString).lastPathComponent)."
                + (brain.isRunning ? " Stop and start the Brain to apply it." : "")
        } catch {
            note = "Could not save: \(error.localizedDescription)"
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
