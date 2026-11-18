import SwiftUI

private let coral = Color(red: 0xC9 / 255, green: 0x64 / 255, blue: 0x42 / 255)

struct ContentView: View {
    @EnvironmentObject private var model: ViewerModel

    var body: some View {
        Group {
            if let view = model.view {
                NousDetail(view: view)
            } else {
                EmptyState(problem: model.problem)
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Button { model.chooseFile() } label: { Label("Open…", systemImage: "folder") }
                    .help("Open a Nous configuration file")
            }
            ToolbarItem(placement: .principal) {
                if model.view != nil { TickControl() }
            }
        }
        .navigationTitle(model.view?.name ?? "Nous")
        .navigationSubtitle(model.fileURL?.lastPathComponent ?? "")
        .tint(coral)
    }
}

private struct EmptyState: View {
    @EnvironmentObject private var model: ViewerModel
    let problem: String?

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: problem == nil ? "person.crop.circle.badge.questionmark" : "exclamationmark.triangle")
                .font(.system(size: 44))
                .foregroundStyle(problem == nil ? Color.secondary : coral)
            Text(problem == nil ? "No Nous open" : "This configuration could not be used")
                .font(.title2.weight(.semibold))
            Text(problem ?? "Open a Nous configuration file to see who it is, what it wants, and how its body changes over time.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 440)
                .textSelection(.enabled)
            Button("Open Nous Configuration…") { model.chooseFile() }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(40)
    }
}

/// Moves the Nous's body forward from birth. Nothing happens to it on the way: no food, no rest.
private struct TickControl: View {
    @EnvironmentObject private var model: ViewerModel

    /// The tick as a whole number, kept inside the range the slider covers.
    private var tickNumber: Binding<Int> {
        Binding(get: { Int(model.tick) }, set: { model.tick = Double(min(max($0, 0), ViewerModel.maxTick)) })
    }

    var body: some View {
        HStack(spacing: 10) {
            Text("Tick").foregroundStyle(.secondary)
            Slider(value: $model.tick, in: 0...Double(ViewerModel.maxTick), step: 1)
                .frame(width: 280)
                .accessibilityLabel("Ticks since birth")
            TextField("Tick", value: tickNumber, format: .number.grouping(.never))
                .textFieldStyle(.roundedBorder)
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .frame(width: 64)
                .accessibilityLabel("Tick number")
            Stepper("Tick", value: $model.tick, in: 0...Double(ViewerModel.maxTick), step: 1).labelsHidden()
        }
        .help("Ticks since birth, with nothing happening to the Nous")
    }
}

private struct NousDetail: View {
    let view: NousView

    var body: some View {
        HSplitView {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Identity(view: view)
                    BodyState(view: view)
                    Goals(goals: view.goals)
                    Personality(traits: view.personality)
                    if !view.triggers.isEmpty { Triggers(triggers: view.triggers) }
                }
                .padding(24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(minWidth: 480)
            PromptPane(prompt: view.systemPrompt)
                .frame(minWidth: 360)
        }
    }
}

private struct SectionTitle: View {
    let text: String
    var body: some View {
        Text(text).font(.headline)
    }
}

private struct Identity: View {
    let view: NousView

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(view.name).font(.system(size: 34, weight: .semibold, design: .serif))
            Text([view.archetype, view.birthDate.isEmpty ? "" : "born \(view.birthDate)"].filter { !$0.isEmpty }.joined(separator: " · "))
                .foregroundStyle(.secondary)
            HStack(spacing: 16) {
                LabeledValue(label: "Mood", value: view.mood)
                LabeledValue(label: "Feels", value: view.emotionalIntensity)
                LabeledValue(label: "Speaks", value: view.communicationStyle)
            }
            if !view.values.isEmpty {
                Text("Values: " + view.values.joined(separator: ", ")).foregroundStyle(.secondary)
            }
        }
    }
}

private struct LabeledValue: View {
    let label: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.body.weight(.medium))
        }
    }
}

private struct BodyState: View {
    let view: NousView

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(text: "Body at tick \(String(view.tick))")
            if let starved = view.starvedAt {
                Label("Left alone, this Nous starves at tick \(String(starved)).", systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(coral)
            }
            HStack(alignment: .top, spacing: 36) {
                GaugeList(title: "Needs", gauges: view.needs)
                GaugeList(title: "Drives", gauges: view.drives)
            }
            Text(String(format: "Sense of time: %.2f× (1.00 is neutral; curiosity stretches it, boredom shrinks it)", view.subjectiveMultiplier))
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if !view.events.isEmpty {
                DisclosureGroup("Changes so far (\(view.events.count))") {
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(view.events.reversed()) { event in
                            Text("tick \(String(event.tick)) · \(event.name) \(event.direction == "rising" ? "rose" : "fell") to \(event.level)")
                                .font(.callout.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
                }
            }
        }
    }
}

/// Three steps — low, med, high. The core reports buckets only, so no finer reading exists.
private struct GaugeList: View {
    let title: String
    let gauges: [NousView.Gauge]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.subheadline).foregroundStyle(.secondary)
            ForEach(gauges) { gauge in
                HStack(spacing: 8) {
                    Text(gauge.name).frame(width: 84, alignment: .leading)
                    HStack(spacing: 3) {
                        ForEach(0..<3, id: \.self) { step in
                            RoundedRectangle(cornerRadius: 2)
                                .fill(step < filled(gauge.level) ? coral : Color.secondary.opacity(0.2))
                                .frame(width: 18, height: 8)
                        }
                    }
                    Text(gauge.level).foregroundStyle(.secondary).frame(width: 36, alignment: .leading)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(gauge.name): \(gauge.level)")
            }
        }
    }

    private func filled(_ level: String) -> Int {
        switch level {
        case "high": return 3
        case "med": return 2
        default: return 1
        }
    }
}

private struct Goals: View {
    let goals: [NousView.Goal]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionTitle(text: "Goals")
            if goals.isEmpty {
                Text("No goals.").foregroundStyle(.secondary)
            }
            ForEach(goals) { goal in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(goal.horizon.replacingOccurrences(of: "_", with: "-"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 84, alignment: .leading)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(goal.description)
                        if goal.domain == "economic" {
                            Text("standing economic target").font(.caption).foregroundStyle(coral)
                        }
                    }
                    Spacer()
                    Text(String(format: "priority %.1f", goal.priority))
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct Personality: View {
    let traits: [NousView.Trait]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionTitle(text: "Personality")
            ForEach(traits) { trait in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(trait.dimension.capitalized).frame(width: 150, alignment: .leading)
                    Text(trait.level).font(.body.weight(.medium)).frame(width: 64, alignment: .leading)
                    Text(trait.description).foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct Triggers: View {
    let triggers: [NousView.Trigger]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionTitle(text: "What moves it")
            ForEach(triggers) { trigger in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(trigger.emotion.capitalized).frame(width: 150, alignment: .leading)
                    Text(trigger.words.joined(separator: " · ")).foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct PromptPane: View {
    let prompt: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("System prompt").font(.headline)
                    Text("Sent with every model call at this tick").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Copy") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(prompt, forType: .string)
                }
            }
            .padding(16)
            Divider()
            ScrollView {
                Text(prompt)
                    .font(.system(.callout, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
            }
        }
        .background(Color(nsColor: .textBackgroundColor))
    }
}
