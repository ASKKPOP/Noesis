import CNoesisBrain
import Foundation

/// What the Rust core reports about one Nous at one tick.
struct NousView: Decodable, Equatable {
    struct Trait: Decodable, Equatable, Identifiable {
        let dimension: String
        let level: String
        let description: String
        var id: String { dimension }
    }

    struct Trigger: Decodable, Equatable, Identifiable {
        let emotion: String
        let words: [String]
        var id: String { emotion }
    }

    struct Goal: Decodable, Equatable, Identifiable {
        let description: String
        let horizon: String
        let domain: String
        let status: String
        let priority: Double
        let progress: Double
        var id: String { horizon + description }
    }

    /// A drive or a need. Only its bucket is known — the core never hands out the raw value.
    struct Gauge: Decodable, Equatable, Identifiable {
        let name: String
        let level: String
        var id: String { name }
    }

    struct Event: Decodable, Equatable, Identifiable {
        let tick: Int
        let kind: String
        let name: String
        let level: String
        let direction: String
        var id: String { "\(tick)-\(kind)-\(name)" }
    }

    let name: String
    let archetype: String
    let birthDate: String
    let communicationStyle: String
    let values: [String]
    let personality: [Trait]
    let mood: String
    let emotionalIntensity: String
    let triggers: [Trigger]
    let goals: [Goal]
    let tick: Int
    let drives: [Gauge]
    let needs: [Gauge]
    let events: [Event]
    let starvedAt: Int?
    let subjectiveMultiplier: Double
    let systemPrompt: String
}

struct BrainCoreError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// A configuration file as a tree, with the closed sets its settings offer.
struct ConfigTree: Decodable {
    struct Choices: Decodable {
        let communicationStyles: [String]
        let emotions: [String]
        let levels: [String]
        let personality: [String]

        enum CodingKeys: String, CodingKey {
            case communicationStyles = "communication_styles"
            case emotions, levels, personality
        }
    }

    let config: JSON
    let choices: Choices
}

enum BrainCore {
    private struct Reply<Value: Decodable>: Decodable {
        let ok: Value?
        let error: String?
    }

    /// Read one answer from the Rust core and release it.
    private static func answer<Value: Decodable>(_ raw: UnsafeMutablePointer<CChar>?, snakeCase: Bool = false) throws -> Value {
        guard let raw else { throw BrainCoreError(message: "The Brain core returned nothing.") }
        defer { noesis_string_free(raw) }
        let decoder = JSONDecoder()
        if snakeCase { decoder.keyDecodingStrategy = .convertFromSnakeCase }
        let reply = try decoder.decode(Reply<Value>.self, from: Data(String(cString: raw).utf8))
        if let value = reply.ok { return value }
        throw BrainCoreError(message: reply.error ?? "The Brain core gave an unreadable answer.")
    }

    /// Ask the Rust core for a Nous built from `yaml`, advanced to `tick`.
    static func view(yaml: String, tick: Int) throws -> NousView {
        try answer(noesis_nous_view(yaml, Int64(tick)), snakeCase: true)
    }

    /// A configuration file as a tree.
    static func config(yaml: String) throws -> ConfigTree {
        try answer(noesis_config_json(yaml))
    }

    /// Merge changes into a configuration file; the new file text.
    static func patch(yaml: String, changes: [String: Any]) throws -> String {
        let patch = String(decoding: try JSONSerialization.data(withJSONObject: changes), as: UTF8.self)
        return try answer(noesis_config_patch(yaml, patch))
    }
}
