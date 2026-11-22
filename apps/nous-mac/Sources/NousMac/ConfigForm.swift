import Foundation

/// The settings of a Nous configuration file that the Brain reads, as a form.
struct ConfigForm: Equatable {
    var name: String
    var archetype: String
    var birthDate: String
    var personality: [String: String]
    var values: [String]
    var style: String
    var mood: String
    var intensity: String
    /// Emotion → the words that stir it, separated by commas.
    var triggers: [String: String]
    var shortTerm: [String]
    var mediumTerm: [String]
    var longTerm: [String]
    var earnMoney: Bool
    var temperature: Double
    var maxTokens: Int

    /// The top-level sections this form edits.
    static let sections = ["identity", "psyche", "thymos", "telos", "llm"]

    /// Missing settings take the Brain's own defaults.
    init(config: JSON, choices: ConfigTree.Choices) {
        func string(_ value: JSON, _ fallback: String) -> String { value.isNull ? fallback : value.text }
        func number(_ value: JSON, _ fallback: Double) -> Double {
            if case .number(let n) = value { return n }
            return fallback
        }
        let (identity, psyche, thymos, telos, llm) = (config["identity"], config["psyche"], config["thymos"], config["telos"], config["llm"])
        name = string(identity["name"], "")
        archetype = string(identity["archetype"], "")
        birthDate = string(identity["birth_date"], "")
        personality = Dictionary(uniqueKeysWithValues: choices.personality.map { ($0, string(psyche["personality"][$0], "medium")) })
        values = psyche["values"].items.map(\.text)
        style = string(psyche["communication_style"], "thoughtful")
        mood = string(thymos["baseline_mood"], "neutral")
        intensity = string(thymos["emotional_intensity"], "medium")
        triggers = Dictionary(uniqueKeysWithValues: choices.emotions.map { ($0, thymos["triggers"][$0].items.map(\.text).joined(separator: ", ")) })
        shortTerm = telos["short_term"].items.map(\.text)
        mediumTerm = telos["medium_term"].items.map(\.text)
        longTerm = telos["long_term"].items.map(\.text)
        if case .bool(let earn) = telos["earn_money"] { earnMoney = earn } else { earnMoney = true }
        temperature = number(llm["temperature"], 0.7)
        maxTokens = Int(number(llm["max_tokens"], 2048))
    }

    private static func tidy(_ items: [String]) -> [String] {
        items.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    private static func words(_ text: String) -> [String] { tidy(text.components(separatedBy: ",")) }

    /// Only what differs from `base`, shaped like the file, for the core to merge in.
    func changes(from base: ConfigForm) -> [String: Any] {
        var identity: [String: Any] = [:], psyche: [String: Any] = [:], thymos: [String: Any] = [:]
        var telos: [String: Any] = [:], llm: [String: Any] = [:]

        if name != base.name { identity["name"] = name }
        if archetype != base.archetype { identity["archetype"] = archetype }
        if birthDate != base.birthDate { identity["birth_date"] = birthDate }

        let levels = personality.filter { base.personality[$0.key] != $0.value }
        if !levels.isEmpty { psyche["personality"] = levels }
        if Self.tidy(values) != Self.tidy(base.values) { psyche["values"] = Self.tidy(values) }
        if style != base.style { psyche["communication_style"] = style }

        if mood != base.mood { thymos["baseline_mood"] = mood }
        if intensity != base.intensity { thymos["emotional_intensity"] = intensity }
        let stirred = triggers.filter { Self.words(base.triggers[$0.key] ?? "") != Self.words($0.value) }.mapValues(Self.words)
        if !stirred.isEmpty { thymos["triggers"] = stirred }

        if Self.tidy(shortTerm) != Self.tidy(base.shortTerm) { telos["short_term"] = Self.tidy(shortTerm) }
        if Self.tidy(mediumTerm) != Self.tidy(base.mediumTerm) { telos["medium_term"] = Self.tidy(mediumTerm) }
        if Self.tidy(longTerm) != Self.tidy(base.longTerm) { telos["long_term"] = Self.tidy(longTerm) }
        if earnMoney != base.earnMoney { telos["earn_money"] = earnMoney }

        if temperature != base.temperature { llm["temperature"] = temperature }
        if maxTokens != base.maxTokens { llm["max_tokens"] = maxTokens }

        let all: [(String, [String: Any])] = [("identity", identity), ("psyche", psyche), ("thymos", thymos), ("telos", telos), ("llm", llm)]
        return Dictionary(uniqueKeysWithValues: all.filter { !$0.1.isEmpty }.map { ($0.0, $0.1 as Any) })
    }
}
