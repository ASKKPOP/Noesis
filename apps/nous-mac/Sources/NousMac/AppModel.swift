import AppKit
import SwiftUI
import UniformTypeIdentifiers

enum Pane: String, CaseIterable, Identifiable {
    case dashboard, chat, map, grid, profile, overview, memory, wiki, localAI, logs, config, settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .chat: return "Chat"
        case .map: return "Map"
        case .grid: return "Grid Access"
        case .profile: return "Profile"
        case .overview: return "Live State"
        case .memory: return "Memory"
        case .wiki: return "Personal Wiki"
        case .localAI: return "Local AI"
        case .logs: return "Brain Process"
        case .config: return "Configuration"
        case .settings: return "Settings"
        }
    }

    var symbol: String {
        switch self {
        case .dashboard: return "square.grid.2x2"
        case .chat: return "bubble.left.and.bubble.right"
        case .map: return "globe"
        case .grid: return "person.badge.key"
        case .profile: return "person.text.rectangle"
        case .overview: return "waveform.path.ecg"
        case .memory: return "clock.arrow.circlepath"
        case .wiki: return "book"
        case .localAI: return "cpu"
        case .logs: return "terminal"
        case .config: return "doc.text"
        case .settings: return "gearshape"
        }
    }
}

struct ChatMessage: Codable, Identifiable, Equatable {
    enum Role: String, Codable { case human, nous, problem }
    var id = UUID()
    let role: Role
    let text: String
    var date = Date()
}

/// Everything the window shows: settings, the Brain process, and the conversation.
@MainActor
final class AppModel: ObservableObject {
    @Published var pane: Pane = .dashboard
    @Published var settings: AppSettings { didSet { if settings != oldValue { settingsChanged(from: oldValue) } } }
    @Published private(set) var secret: String
    @Published private(set) var messages: [ChatMessage] = []
    @Published private(set) var waitingForReply = false
    @Published var startProblem: String?

    let viewer = ViewerModel()
    let brain = BrainProcess()
    let map = MapBrowser()

    init() {
        settings = AppFiles.loadSettings()
        secret = AppFiles.brainSecret()
        viewer.load(path: settings.configPath)
        messages = loadMessages()
        stopBrainWhenKilled()
    }

    private var termination: DispatchSourceSignal?

    /// Quitting stops the Brain; so must being terminated from outside, or the Brain would
    /// be left running with nothing managing it.
    private func stopBrainWhenKilled() {
        signal(SIGTERM, SIG_IGN)
        let source = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
        source.setEventHandler { [brain] in
            brain.stop()
            exit(0)
        }
        source.resume()
        termination = source
    }

    var api: BrainAPI { BrainAPI(port: settings.httpPort, secret: secret) }

    /// The Nous's name from its configuration, via the Rust core.
    var nousName: String { viewer.view?.name ?? "Nous" }

    // MARK: Configuration

    func chooseConfigFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [UTType(filenameExtension: "yaml"), UTType(filenameExtension: "yml")].compactMap { $0 }
        panel.message = "Choose a Nous configuration file"
        if panel.runModal() == .OK, let url = panel.url { useConfig(at: url.path) }
    }

    func chooseBrainDirectory() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.message = "Choose the Noēsis brain directory"
        if panel.runModal() == .OK, let url = panel.url { settings.brainDir = url.path }
    }

    /// Use the configuration at `path`. A file inside a `brain/` checkout also sets the
    /// Brain directory when none is set yet.
    func useConfig(at path: String) {
        var next = settings
        next.configPath = path
        if next.brainDir.isEmpty, let range = path.range(of: "/brain/", options: .backwards) {
            next.brainDir = String(path[..<range.lowerBound]) + "/brain"
        }
        settings = next
    }

    private func settingsChanged(from old: AppSettings) {
        AppFiles.save(settings)
        if settings.configPath != old.configPath {
            viewer.load(path: settings.configPath)
            messages = loadMessages()
        }
    }

    func regenerateSecret() {
        secret = AppFiles.brainSecret(regenerate: true)
    }

    // MARK: Brain process

    func startBrain() {
        startProblem = brain.start(settings: settings, secret: secret, nousName: nousName)
    }

    // MARK: Chat

    private var chatFile: URL? {
        guard !settings.configPath.isEmpty else { return nil }
        let dir = AppFiles.directory.appendingPathComponent("chats", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let name = settings.configPath.replacingOccurrences(of: "/", with: "_")
        return dir.appendingPathComponent(name + ".json")
    }

    private func loadMessages() -> [ChatMessage] {
        guard let chatFile, let data = try? Data(contentsOf: chatFile) else { return [] }
        return (try? JSONDecoder().decode([ChatMessage].self, from: data)) ?? []
    }

    private func saveMessages() {
        guard let chatFile else { return }
        // Problems are about this session, not part of the conversation.
        try? JSONEncoder().encode(messages.filter { $0.role != .problem }).write(to: chatFile, options: .atomic)
    }

    func send(_ text: String) {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !waitingForReply else { return }
        // What the Nous is shown of the conversation so far (the Brain keeps the most recent part).
        let history = messages.filter { $0.role != .problem }.suffix(20)
            .map { (human: $0.role == .human, text: String($0.text.prefix(4000))) }
        messages.append(ChatMessage(role: .human, text: text))
        saveMessages()
        waitingForReply = true
        let api = api
        Task {
            do {
                let reply = try await api.chat(text, history: history)
                messages.append(ChatMessage(role: .nous, text: reply.isEmpty ? "(no reply)" : reply))
            } catch {
                messages.append(ChatMessage(role: .problem, text: error.localizedDescription))
            }
            waitingForReply = false
            saveMessages()
        }
    }

    func clearChat() {
        messages = []
        saveMessages()
    }
}
