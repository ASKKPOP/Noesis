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
    /// Why the Brain is not up right now while it is meant to be, and what the app is doing about it.
    @Published private(set) var brainNotice: String?
    /// Set while the local model server does not answer.
    @Published private(set) var localAINotice: String?
    /// Why the last alert did not also go out by email, if it did not.
    @Published private(set) var emailNotice: String?

    let viewer = ViewerModel()
    let brain = BrainProcess()
    let map = MapBrowser()
    let account = GridAccount()
    let localAI = LocalAIMonitor()

    init() {
        settings = AppFiles.loadSettings()
        secret = AppFiles.brainSecret()
        viewer.load(path: settings.configPath)
        messages = loadMessages()
        stopBrainWhenKilled()
        brain.onExit = { [weak self] in self?.brainExited() }
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

    // MARK: Grid account

    /// Sign in with the stored password if there is one and the session needs it.
    func restoreAccount() async {
        guard let grid = settings.grid else { return }
        await account.restore(email: settings.accountEmail, grid: grid)
    }

    // MARK: Brain process

    private var brainWatch = FailureWatch()
    private var localAIWatch = FailureWatch()
    private var brainStartedAt = Date.distantPast
    private var watching = false
    private var quitting = false

    /// Start the Brain and keep it running from now on: it is started again with the app
    /// and restarted whenever it exits, until Stop.
    func startBrain() {
        startProblem = launchBrain()
        guard startProblem == nil else { return }
        settings.keepBrainRunning = true
        brainWatch = FailureWatch()
        brainNotice = nil
        Alerts.askPermission()
    }

    /// The app is closing: the Brain goes with it and comes back the next time the app opens.
    func quit() {
        quitting = true
        brain.stop()
    }

    /// The only way the Brain stays stopped.
    func stopBrain() {
        settings.keepBrainRunning = false
        brainNotice = nil
        localAINotice = nil
        emailNotice = nil
        brain.stop()
    }

    /// Called once when the app opens: bring the Brain back if it was left running, and
    /// keep watching the local model server.
    func keepAlive() async {
        guard !watching else { return }
        watching = true
        if settings.keepBrainRunning, !brain.isRunning, launchBrain() != nil { brainFailed() }
        while !Task.isCancelled {
            if settings.keepBrainRunning { await checkLocalAI() }
            try? await Task.sleep(for: .seconds(15))
        }
    }

    private func launchBrain() -> String? {
        let problem = brain.start(settings: settings, secret: secret, nousName: nousName)
        if problem == nil { brainStartedAt = Date() }
        return problem
    }

    private func brainExited() {
        guard settings.keepBrainRunning, !quitting else { return }
        if Date().timeIntervalSince(brainStartedAt) >= FailureWatch.settledAfter { brainWatch.recovered() }
        brainFailed()
    }

    /// The Brain is down while it should be up: tell the user if this has gone on, then try again.
    private func brainFailed() {
        if brainWatch.failed() {
            Alerts.send(title: "\(nousName)'s Brain keeps stopping",
                        message: "It has failed to stay running \(FailureWatch.alertAfter) times in a row. The app keeps trying. Open Brain Process to see why.")
            emailAlert(.brainDown)
        }
        let wait = brainWatch.retryDelay
        brainNotice = "The Brain stopped. Starting it again in \(Int(wait)) seconds (try \(brainWatch.failures))."
        Task {
            try? await Task.sleep(for: .seconds(wait))
            guard settings.keepBrainRunning, !quitting, !brain.isRunning else { return }
            if launchBrain() == nil { brainNotice = nil } else { brainFailed() }
        }
    }

    /// The same alert by email, through the signed-in account on the Grid.
    private func emailAlert(_ alert: GridAccount.Alert) {
        guard let grid = settings.grid else { return }
        Task { emailNotice = await account.emailAlert(alert, nous: nousName, email: settings.accountEmail, grid: grid) }
    }

    /// The Brain asks the model server afresh for every thought, so it reconnects by
    /// itself the moment the server answers again; this keeps checking and reports.
    private func checkLocalAI() async {
        do {
            _ = try await LocalModels.installed(host: settings.ollamaHost)
            if localAIWatch.recovered() {
                Alerts.send(title: "Local AI is connected again", message: "\(nousName) can think again.")
            }
            localAINotice = nil
        } catch {
            if localAIWatch.failed() {
                Alerts.send(title: "\(nousName) cannot reach its local AI",
                            message: "The model server at \(settings.ollamaHost) has not answered \(FailureWatch.alertAfter) times in a row. The app keeps trying. Check that Ollama is running.")
                emailAlert(.localAIDown)
            }
            localAINotice = "Local AI is not answering. Trying again every 15 seconds (try \(localAIWatch.failures))."
        }
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
