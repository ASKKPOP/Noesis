import Charts
import SwiftUI

/// What the local model server's processes are using on this Mac at one moment.
struct UsageSample: Identifiable, Equatable {
    let date: Date
    /// Share of the whole Mac's processor, 0–100 (all cores busy = 100).
    let cpuPercent: Double
    let memoryBytes: Double
    var id: Date { date }
}

/// A model the server holds in memory right now (Ollama `/api/ps`).
struct LoadedModel: Identifiable, Equatable {
    let name: String
    let memoryBytes: Double
    var id: String { name }
}

enum ProcessUsage {
    /// Add up the processor share and memory of every process whose path contains
    /// `marker`, from the output of `ps -axo pcpu=,rss=,comm=` (percent of one core,
    /// kilobytes, path). Nil when no such process is running.
    static func total(psOutput: String, marker: String, cores: Int) -> (cpuPercent: Double, memoryBytes: Double)? {
        var cpu = 0.0, kilobytes = 0.0, found = false
        for line in psOutput.split(whereSeparator: \.isNewline) {
            let parts = line.split(separator: " ", maxSplits: 2, omittingEmptySubsequences: true)
            guard parts.count == 3, let c = Double(parts[0]), let k = Double(parts[1]),
                  parts[2].localizedCaseInsensitiveContains(marker) else { continue }
            cpu += c
            kilobytes += k
            found = true
        }
        return found ? (min(100, cpu / Double(max(1, cores))), kilobytes * 1024) : nil
    }

    /// Ask the system now. Runs `ps`, so call it off the main thread.
    static func ofModelServer() -> (cpuPercent: Double, memoryBytes: Double)? {
        let ps = Process()
        ps.executableURL = URL(fileURLWithPath: "/bin/ps")
        ps.arguments = ["-axo", "pcpu=,rss=,comm="]
        let pipe = Pipe()
        ps.standardOutput = pipe
        guard (try? ps.run()) != nil else { return nil }
        let output = String(decoding: pipe.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
        ps.waitUntilExit()
        return total(psOutput: output, marker: "ollama", cores: ProcessInfo.processInfo.activeProcessorCount)
    }
}

/// Samples the model server every few seconds for as long as the app is open.
@MainActor
final class LocalAIMonitor: ObservableObject {
    /// One hour at one sample every three seconds.
    static let keep = 1200
    static let every: Duration = .seconds(3)

    @Published private(set) var samples: [UsageSample] = []
    @Published private(set) var loaded: [LoadedModel] = []
    /// False when no model server process is running on this Mac.
    @Published private(set) var serverRunning = true

    private var watching = false

    func watch(host: @escaping () -> String) async {
        guard !watching else { return }
        watching = true
        while !Task.isCancelled {
            let usage = await Task.detached { ProcessUsage.ofModelServer() }.value
            serverRunning = usage != nil
            samples.append(UsageSample(date: Date(), cpuPercent: usage?.cpuPercent ?? 0, memoryBytes: usage?.memoryBytes ?? 0))
            if samples.count > Self.keep { samples.removeFirst(samples.count - Self.keep) }
            loaded = await Self.loadedModels(host: host())
            try? await Task.sleep(for: Self.every)
        }
    }

    private static func loadedModels(host: String) async -> [LoadedModel] {
        guard let url = URL(string: host.trimmingCharacters(in: .whitespaces) + "/api/ps"),
              let (data, _) = try? await URLSession.shared.data(for: URLRequest(url: url, timeoutInterval: 3)),
              let json = try? JSONDecoder().decode(JSON.self, from: data) else { return [] }
        return json["models"].items.map { LoadedModel(name: $0["name"].text, memoryBytes: Double($0["size"].text) ?? 0) }
    }
}

/// The "Working now" section of Local AI: status, and processor and memory over time.
struct LocalAIUsageSection: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var monitor: LocalAIMonitor

    private static let physicalMemory = Double(ProcessInfo.processInfo.physicalMemory)
    private static func gigabytes(_ bytes: Double) -> String { String(format: "%.1f GB", bytes / 1_073_741_824) }

    /// Above this share of the Mac's processor the model server is taken to be thinking.
    private static let busyAbove = 5.0

    private var status: String {
        guard monitor.serverRunning else { return "Not running" }
        guard let now = monitor.samples.last else { return "Checking…" }
        if now.cpuPercent >= Self.busyAbove { return "Thinking" }
        return monitor.loaded.isEmpty ? "Idle, no model in memory" : "Idle, model ready in memory"
    }

    var body: some View {
        Section {
            LabeledContent("Status") {
                HStack(spacing: 6) {
                    Circle().fill(monitor.serverRunning ? ((monitor.samples.last?.cpuPercent ?? 0) >= Self.busyAbove ? coral : Color.green) : Color.secondary.opacity(0.5))
                        .frame(width: 8, height: 8)
                    Text(status)
                }
            }
            ForEach(monitor.loaded) { model in
                LabeledContent("In memory", value: "\(model.name) · \(Self.gigabytes(model.memoryBytes))")
            }
            graph(title: "Processor", now: monitor.samples.last.map { String(format: "%.0f%% of this Mac", $0.cpuPercent) },
                  top: 100, value: \.cpuPercent, axis: { "\(Int($0))%" })
            graph(title: "Memory", now: monitor.samples.last.map { "\(Self.gigabytes($0.memoryBytes)) of \(Self.gigabytes(Self.physicalMemory))" },
                  top: Self.physicalMemory, value: \.memoryBytes, axis: { String(format: "%.0f GB", $0 / 1_073_741_824) })
        } header: {
            Text("Working now")
        } footer: {
            Text("The model server's processes on this Mac, measured every 3 seconds for as long as this app is open. The last hour is shown.")
        }
    }

    private func graph(title: String, now: String?, top: Double, value: KeyPath<UsageSample, Double>, axis: @escaping (Double) -> String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                Spacer()
                Text(now ?? "—").foregroundStyle(.secondary).monospacedDigit()
            }
            Chart(monitor.samples) { sample in
                AreaMark(x: .value("Time", sample.date), y: .value(title, sample[keyPath: value]))
                    .foregroundStyle(coral.opacity(0.18))
                LineMark(x: .value("Time", sample.date), y: .value(title, sample[keyPath: value]))
                    .foregroundStyle(coral)
            }
            .chartYScale(domain: 0...top)
            .chartYAxis {
                AxisMarks(values: [0, top / 2, top]) { mark in
                    AxisGridLine()
                    AxisValueLabel { if let v = mark.as(Double.self) { Text(axis(v)) } }
                }
            }
            .chartXAxis { AxisMarks(values: .automatic(desiredCount: 4)) { _ in AxisGridLine(); AxisValueLabel(format: .dateTime.hour().minute()) } }
            .frame(height: 110)
            .accessibilityLabel("\(title) used by the local AI over the last hour")
        }
        .padding(.vertical, 4)
    }
}
