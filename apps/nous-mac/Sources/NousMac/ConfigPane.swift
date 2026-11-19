import SwiftUI

/// The Nous's configuration file, as grouped settings or as text. Both edit the same
/// file text; the Rust core reads it, merges the settings in and checks the result, and
/// text it cannot read as a Nous cannot be saved.
struct ConfigPane: View {
    private enum Mode: String, CaseIterable {
        case settings = "Settings"
        case text = "Text"
    }

    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var brain: BrainProcess
    @State private var mode = Mode.settings
    @State private var text = ""
    @State private var saved = ""
    @State private var note: String?
    /// The form, the form as last read from the text, and that text.
    @State private var form: ConfigForm?
    @State private var base: ConfigForm?
    @State private var baseText = ""
    @State private var tree: ConfigTree?
    @State private var formProblem: String?

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
                header
                Divider()
                switch mode {
                case .settings: settings
                case .text: editor
                }
            }
            .onAppear(perform: load)
            .onChange(of: path) { _, _ in load() }
            .onChange(of: text) { _, _ in note = nil }
            .onChange(of: mode) { _, new in if new == .settings { readForm() } }
            .onChange(of: form) { _, _ in writeForm() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text((path as NSString).lastPathComponent).font(.headline)
                    Text(path).font(.caption).foregroundStyle(.secondary).lineLimit(1).truncationMode(.middle)
                }
                Spacer()
                Picker("View", selection: $mode) {
                    ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .fixedSize()
                Button("Choose Another…") { app.chooseConfigFile() }
                Button("Revert") { load() }.disabled(text == saved)
                Button("Save") { save() }.buttonStyle(.borderedProminent).disabled(text == saved || problem != nil)
                    .keyboardShortcut("s")
            }
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
        }
        .padding(16)
    }

    private var editor: some View {
        TextEditor(text: $text)
            .font(.system(.body, design: .monospaced))
            .autocorrectionDisabled()
            .scrollContentBackground(.hidden)
            .padding(8)
            .background(Color(nsColor: .textBackgroundColor))
            .accessibilityLabel("Configuration text")
    }

    @ViewBuilder private var settings: some View {
        if let tree, form != nil {
            let form = Binding(get: { self.form ?? ConfigForm(config: tree.config, choices: tree.choices) }, set: { self.form = $0 })
            ConfigSettings(form: form, choices: tree.choices, otherSections: otherSections(tree), losesComments: saved.contains("#"))
        } else {
            Notice(symbol: "exclamationmark.triangle", title: "This file cannot be shown as settings",
                   message: (formProblem ?? "It could not be read.") + " Fix it under Text.")
        }
    }

    /// Sections in the file that the settings do not cover.
    private func otherSections(_ tree: ConfigTree) -> [String] {
        tree.config.fields.map(\.key).filter { !ConfigForm.sections.contains($0) }
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
        readForm()
    }

    /// Rebuild the form from the text as it stands.
    private func readForm() {
        do {
            let read = try BrainCore.config(yaml: text)
            let fresh = ConfigForm(config: read.config, choices: read.choices)
            (tree, base, baseText, formProblem) = (read, fresh, text, nil)
            form = fresh
        } catch {
            (tree, base, form, formProblem) = (nil, nil, nil, error.localizedDescription)
        }
    }

    /// Carry the form's changes into the text. An unchanged form leaves the text alone.
    private func writeForm() {
        guard mode == .settings, let form, let base else { return }
        let changes = form.changes(from: base)
        do {
            text = changes.isEmpty ? baseText : try BrainCore.patch(yaml: baseText, changes: changes)
        } catch {
            note = "Could not apply the change: \(error.localizedDescription)"
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
            readForm()
            app.viewer.load(path: path)
            note = "Saved. The previous version is at \((backup as NSString).lastPathComponent)."
                + (brain.isRunning ? " Stop and start the Brain to apply it." : "")
        } catch {
            note = "Could not save: \(error.localizedDescription)"
        }
    }
}

/// The grouped settings themselves.
private struct ConfigSettings: View {
    @Binding var form: ConfigForm
    let choices: ConfigTree.Choices
    let otherSections: [String]
    let losesComments: Bool

    var body: some View {
        Form {
            Section("Identity") {
                TextField("Name", text: $form.name)
                TextField("Archetype", text: $form.archetype)
                TextField("Birth date", text: $form.birthDate, prompt: Text("2026-04-15"))
            }
            Section("Personality") {
                ForEach(choices.personality, id: \.self) { dimension in
                    ChoicePicker(title: dimension.capitalized, options: choices.levels, selection: entry($form.personality, dimension))
                }
                ChoicePicker(title: "Communication style", options: choices.communicationStyles, selection: $form.style)
            }
            Section("Values") {
                ListRows(items: $form.values, noun: "value")
            }
            Section {
                TextField("Usual mood", text: $form.mood)
                ChoicePicker(title: "Emotional intensity", options: choices.levels, selection: $form.intensity)
            } header: {
                Text("Emotions")
            } footer: {
                Text("The mood this Nous returns to, and how strongly it feels.")
            }
            Section {
                ForEach(choices.emotions, id: \.self) { emotion in
                    TextField(emotion.capitalized, text: entry($form.triggers, emotion), prompt: Text("Nothing"))
                }
            } header: {
                Text("What stirs each emotion")
            } footer: {
                Text("Words or phrases, separated by commas.")
            }
            Section("Short-term goals") { ListRows(items: $form.shortTerm, noun: "goal") }
            Section("Medium-term goals") { ListRows(items: $form.mediumTerm, noun: "goal") }
            Section("Long-term goals") { ListRows(items: $form.longTerm, noun: "goal") }
            Section {
                Toggle("Seek to earn money", isOn: $form.earnMoney)
            } footer: {
                Text("Gives this Nous the standing goal of earning money, beside the goals above.")
            }
            Section {
                TextField("Temperature", value: $form.temperature, format: .number.precision(.fractionLength(0...2)))
                TextField("Longest answer (tokens)", value: $form.maxTokens, format: .number.grouping(.never))
            } header: {
                Text("Thinking")
            } footer: {
                Text("Used while this Nous runs on its own. The model itself is chosen under Local AI.")
            }
            if !otherSections.isEmpty || losesComments {
                Section {
                    if !otherSections.isEmpty {
                        Text("The file also has \(otherSections.joined(separator: ", ")). These are kept as they are; change them under Text.")
                    }
                    if losesComments {
                        Text("Saving a change made here rewrites the file without its comments. The previous version is kept beside it.")
                    }
                }
                .font(.callout)
                .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }

    private func entry(_ dictionary: Binding<[String: String]>, _ key: String) -> Binding<String> {
        Binding(get: { dictionary.wrappedValue[key] ?? "" }, set: { dictionary.wrappedValue[key] = $0 })
    }
}

/// A pop-up of a closed set. A value the file holds that is outside the set stays selectable.
private struct ChoicePicker: View {
    let title: String
    let options: [String]
    @Binding var selection: String

    var body: some View {
        Picker(title, selection: $selection) {
            ForEach(options.contains(selection) ? options : options + [selection], id: \.self) { option in
                Text(option.capitalized).tag(option)
            }
        }
    }
}

/// An editable list: one row each, with remove and add.
private struct ListRows: View {
    @Binding var items: [String]
    let noun: String

    var body: some View {
        ForEach(items.indices, id: \.self) { index in
            HStack {
                TextField("\(noun.capitalized) \(index + 1)", text: Binding(
                    get: { index < items.count ? items[index] : "" },
                    set: { if index < items.count { items[index] = $0 } }
                ))
                .labelsHidden()
                Button {
                    if index < items.count { items.remove(at: index) }
                } label: {
                    Image(systemName: "minus.circle")
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Remove \(noun) \(index + 1)")
            }
        }
        Button("Add \(noun.capitalized)") { items.append("") }
    }
}
