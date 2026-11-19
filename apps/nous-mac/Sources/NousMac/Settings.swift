import Foundation

/// How this app finds and launches the Nous's Brain. Saved in Application Support.
struct AppSettings: Codable, Equatable {
    /// The repository's `brain/` directory: the working directory of the Brain process.
    var brainDir = ""
    /// Python to run the Brain with: absolute, or relative to `brainDir`.
    var pythonPath = ".venv/bin/python"
    /// The Nous's YAML configuration file.
    var configPath = ""
    var httpPort = 8090
    /// Extra environment for the Brain, one `KEY=VALUE` per line (e.g. `GRID_URL=…`).
    var extraEnv = ""
    /// The local model the Nous thinks with. Empty = the Brain's own default.
    var model = ""
    /// Where the local model server (Ollama) listens.
    var ollamaHost = "http://localhost:11434"
    /// The Portal page that shows the map of Grids.
    var mapURL = "https://noesiis.com/worldmap/orbital"

    init() {}

    /// Settings saved by an older version of the app lack newer fields; those keep their defaults.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = AppSettings()
        brainDir = try c.decodeIfPresent(String.self, forKey: .brainDir) ?? d.brainDir
        pythonPath = try c.decodeIfPresent(String.self, forKey: .pythonPath) ?? d.pythonPath
        configPath = try c.decodeIfPresent(String.self, forKey: .configPath) ?? d.configPath
        httpPort = try c.decodeIfPresent(Int.self, forKey: .httpPort) ?? d.httpPort
        extraEnv = try c.decodeIfPresent(String.self, forKey: .extraEnv) ?? d.extraEnv
        model = try c.decodeIfPresent(String.self, forKey: .model) ?? d.model
        ollamaHost = try c.decodeIfPresent(String.self, forKey: .ollamaHost) ?? d.ollamaHost
        mapURL = try c.decodeIfPresent(String.self, forKey: .mapURL) ?? d.mapURL
    }

    var python: String {
        pythonPath.hasPrefix("/") ? pythonPath : (brainDir as NSString).appendingPathComponent(pythonPath)
    }

    var environment: [String: String] {
        var env: [String: String] = [:]
        for line in extraEnv.split(whereSeparator: \.isNewline) {
            let parts = line.split(separator: "=", maxSplits: 1)
            let key = parts.first.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
            if parts.count == 2, !key.isEmpty, !key.hasPrefix("#") {
                env[key] = parts[1].trimmingCharacters(in: .whitespaces)
            }
        }
        return env
    }
}

enum AppFiles {
    static var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("Nous", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func loadSettings() -> AppSettings {
        guard let data = try? Data(contentsOf: directory.appendingPathComponent("settings.json")),
              let settings = try? JSONDecoder().decode(AppSettings.self, from: data) else { return AppSettings() }
        return settings
    }

    static func save(_ settings: AppSettings) {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try? encoder.encode(settings).write(to: directory.appendingPathComponent("settings.json"), options: .atomic)
    }

    /// The shared secret between this app and the Brain's local HTTP port. Created on first
    /// use, kept in a file only this user can read, and never shown in the settings file.
    static func brainSecret(regenerate: Bool = false) -> String {
        let url = directory.appendingPathComponent("brain-secret")
        if !regenerate, let saved = try? String(contentsOf: url, encoding: .utf8), saved.count >= 32 {
            return saved
        }
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let secret = bytes.map { String(format: "%02x", $0) }.joined()
        FileManager.default.createFile(atPath: url.path, contents: Data(secret.utf8), attributes: [.posixPermissions: 0o600])
        return secret
    }
}
