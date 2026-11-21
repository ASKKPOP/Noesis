import SwiftUI

/// Reads one Brain route now and every `every` seconds while its screen is open.
@MainActor
final class LiveData: ObservableObject {
    /// Forget what was read (the Brain stopped).
    func clear() { value = nil; problem = nil }

    @Published private(set) var value: JSON?
    @Published private(set) var problem: String?

    func poll(_ path: String, every seconds: UInt64, api: @escaping () -> BrainAPI) async {
        while !Task.isCancelled {
            do {
                value = try await api().get(path)
                problem = nil
            } catch {
                value = nil
                problem = error.localizedDescription
            }
            try? await Task.sleep(nanoseconds: seconds * 1_000_000_000)
        }
    }
}

/// The shell every live screen shares: the Brain must be running and answering.
private struct LiveScreen<Content: View>: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var brain: BrainProcess
    @StateObject private var data = LiveData()
    let path: String
    let every: UInt64
    @ViewBuilder let content: (JSON) -> Content

    var body: some View {
        Group {
            if let value = data.value {
                ScrollView { content(value).padding(24).frame(maxWidth: .infinity, alignment: .leading) }
            } else if let problem = data.problem {
                Notice(symbol: brain.isRunning ? "exclamationmark.triangle" : "moon.zzz",
                       title: brain.isRunning ? "The Brain is not answering yet" : "The Brain is stopped",
                       message: brain.isRunning ? problem : "Start the Brain from the sidebar to see this.")
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task(id: path) { await data.poll(path, every: every) { app.api } }
    }
}

/// What the running Nous is right now, straight from its Brain.
struct OverviewPane: View {
    private let columns = [GridItem(.adaptive(minimum: 320), spacing: 16, alignment: .top)]

    var body: some View {
        LiveScreen(path: "/local/state", every: 2) { s in
            LazyVGrid(columns: columns, alignment: .leading, spacing: 16) {
                Card(title: s["name"].text.isEmpty ? "Nous" : s["name"].text) {
                    KeyValue(key: "Archetype", value: s["archetype"].text)
                    KeyValue(key: "DID", value: s["did"].text)
                    KeyValue(key: "Grid", value: s["grid_name"].text)
                    KeyValue(key: "Location", value: s["location"].text)
                    KeyValue(key: "Mood", value: s["mood"].text)
                    KeyValue(key: "Emotions", value: s["emotions"].text)
                }
                Card(title: "Goals") {
                    if s["active_goals"].items.isEmpty { Text("No active goals.").foregroundStyle(.secondary) }
                    ForEach(Array(s["active_goals"].items.enumerated()), id: \.offset) { _, goal in
                        Text("• " + goal.text).textSelection(.enabled)
                    }
                }
                Card(title: "Perception") {
                    KeyValue(key: "World size", value: s["aisthesis"]["world_size"].text)
                    KeyValue(key: "Latest percepts", value: s["aisthesis"]["percept_count"].text)
                    ForEach(Array(s["aisthesis"]["percepts"].items.prefix(6).enumerated()), id: \.offset) { _, p in
                        Text("\(p["label"].text) · \(p["kind"].text)").foregroundStyle(.secondary)
                    }
                }
                Card(title: "Action") {
                    KeyValue(key: "Total deeds", value: s["praxis"]["total_deeds"].text)
                    KeyValue(key: "Repertoire", value: s["praxis"]["repertoire_size"].text + " verbs")
                    ForEach(Array(s["praxis"]["verb_counts"].fields.prefix(8)), id: \.key) { verb, count in
                        Text("\(verb) × \(count.text)").foregroundStyle(.secondary)
                    }
                }
                Card(title: "Research") {
                    KeyValue(key: "Digests", value: s["synopsis"]["count"].text)
                    if !s["synopsis"]["latest"].isNull {
                        KeyValue(key: "Latest topic", value: s["synopsis"]["latest"]["topic"].text)
                        ForEach(Array(s["synopsis"]["latest"]["key_points"].items.prefix(3).enumerated()), id: \.offset) { _, point in
                            Text("• " + point.text).foregroundStyle(.secondary)
                        }
                    }
                }
                Card(title: "Memory highlights") {
                    if s["memory_highlights"].items.isEmpty { Text("Nothing yet.").foregroundStyle(.secondary) }
                    ForEach(Array(s["memory_highlights"].items.enumerated()), id: \.offset) { _, m in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(m["content"].text).textSelection(.enabled)
                            Text("importance \(m["importance"].text)").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}

/// The Nous's recent memories, newest first, in full.
struct MemoryPane: View {
    var body: some View {
        LiveScreen(path: "/local/memory/recent?limit=100", every: 4) { data in
            let rows = data["memories"].items
            VStack(alignment: .leading, spacing: 14) {
                Text("\(rows.count) most recent memories").foregroundStyle(.secondary)
                if rows.isEmpty { Text("No memories yet.").foregroundStyle(.secondary) }
                ForEach(Array(rows.enumerated()), id: \.offset) { _, m in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(m["content"].text).textSelection(.enabled)
                        Text([m["memory_type"].text, "tick \(m["tick"].text)", "importance \(m["importance"].text)", m["source_did"].text]
                            .filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Divider()
                }
            }
        }
    }
}

/// What the Nous has written down as knowledge.
struct WikiPane: View {
    var body: some View {
        LiveScreen(path: "/local/wiki/pages", every: 6) { data in
            let pages = data["pages"].items
            VStack(alignment: .leading, spacing: 16) {
                if pages.isEmpty { Text("The personal wiki is empty.").foregroundStyle(.secondary) }
                ForEach(Array(pages.enumerated()), id: \.offset) { _, p in
                    Card(title: p["title"].text) {
                        Text("\(p["category"].text) · confidence \(Int(((Double(p["confidence"].text) ?? 0) * 100).rounded()))%")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(p["content"].text).textSelection(.enabled)
                        if !p["source"].text.isEmpty {
                            Text("source: \(p["source"].text)").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}

