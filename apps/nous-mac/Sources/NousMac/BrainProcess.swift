import Foundation

/// Starts and stops the Nous's Brain process and keeps its recent output.
final class BrainProcess: ObservableObject {
    private static let maxLogLines = 2000

    @Published private(set) var isRunning = false
    @Published private(set) var pid: Int32?
    @Published private(set) var logs: [String] = []

    private var process: Process?
    /// Called on the main queue each time the Brain process ends, however it ended.
    var onExit: (() -> Void)?

    /// Launch `python -m noesis_brain`. Returns why it could not start, or nil.
    func start(settings: AppSettings, secret: String, nousName: String) -> String? {
        if isRunning { return "The Brain is already running." }
        guard !settings.brainDir.isEmpty else { return "Set the Brain directory in Settings first." }
        guard FileManager.default.isExecutableFile(atPath: settings.python) else {
            return "Python was not found at \(settings.python). Check Settings."
        }
        guard !settings.configPath.isEmpty else { return "Choose a Nous configuration first." }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: settings.python)
        process.arguments = ["-m", "noesis_brain"]
        process.currentDirectoryURL = URL(fileURLWithPath: settings.brainDir)
        var env = ProcessInfo.processInfo.environment
        env["BRAIN_HTTP_SECRET"] = secret
        env["BRAIN_HTTP_PORT"] = String(settings.httpPort)
        env["NOUS_CONFIG"] = settings.configPath
        env["PYTHONUNBUFFERED"] = "1"
        let dataDir = settings.brainDataDir
        try? FileManager.default.createDirectory(at: dataDir, withIntermediateDirectories: true)
        env["BRAIN_DATA_DIR"] = dataDir.path
        // The Brain takes its name, and from it its Nous ID, from here, not from the file.
        env["NOUS_NAME"] = nousName.lowercased()
        if settings.joinGrid, let grid = settings.grid { env["GRID_URL"] = grid.absoluteString }
        env["LLM_PROVIDER"] = "ollama"
        env["OLLAMA_HOST"] = settings.ollamaHost
        if !settings.model.isEmpty { env["LLM_MODEL"] = settings.model }
        env.merge(settings.environment) { _, extra in extra }
        process.environment = env

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let text = String(decoding: handle.availableData, as: UTF8.self)
            guard !text.isEmpty else { return }
            DispatchQueue.main.async { self?.append(text) }
        }
        process.terminationHandler = { [weak self] finished in
            DispatchQueue.main.async {
                pipe.fileHandleForReading.readabilityHandler = nil
                self?.append("[app] Brain exited with code \(finished.terminationStatus)")
                self?.isRunning = false
                self?.pid = nil
                self?.process = nil
                self?.onExit?()
            }
        }

        append("[app] starting \(settings.python) -m noesis_brain in \(settings.brainDir)")
        do {
            try process.run()
        } catch {
            return "The Brain could not be started: \(error.localizedDescription)"
        }
        self.process = process
        isRunning = true
        pid = process.processIdentifier
        return nil
    }

    func stop() {
        guard let process, process.isRunning else { return }
        append("[app] stopping the Brain…")
        process.terminate()
    }

    private func append(_ text: String) {
        logs.append(contentsOf: text.split(whereSeparator: \.isNewline).map(String.init))
        if logs.count > Self.maxLogLines { logs.removeFirst(logs.count - Self.maxLogLines) }
    }
}
