import Foundation

/// Any JSON value. The Brain's local state is read defensively: a field that is missing
/// or of another shape shows as empty rather than failing the whole screen.
enum JSON: Decodable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSON])
    case object([String: JSON])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([JSON].self) { self = .array(v) }
        else { self = .object(try c.decode([String: JSON].self)) }
    }

    subscript(key: String) -> JSON {
        if case .object(let o) = self { return o[key] ?? .null }
        return .null
    }

    var items: [JSON] {
        if case .array(let a) = self { return a }
        return []
    }

    var fields: [(key: String, value: JSON)] {
        if case .object(let o) = self { return o.sorted { $0.key < $1.key } }
        return []
    }

    var isNull: Bool { self == .null }

    /// The value as it reads to a person; empty for null.
    var text: String {
        switch self {
        case .null: return ""
        case .bool(let b): return b ? "yes" : "no"
        case .number(let n): return n == n.rounded() && abs(n) < 1e15 ? String(Int64(n)) : String(n)
        case .string(let s): return s
        case .array(let a): return a.map(\.text).joined(separator: ", ")
        case .object(let o): return o.sorted { $0.key < $1.key }.map { "\($0.key): \($0.value.text)" }.joined(separator: ", ")
        }
    }
}

struct BrainAPIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// The Brain's local HTTP interface on this machine.
struct BrainAPI {
    let port: Int
    let secret: String

    private func request(_ path: String, body: [String: String]? = nil, timeout: TimeInterval) async throws -> Data {
        guard let url = URL(string: "http://127.0.0.1:\(port)\(path)") else {
            throw BrainAPIError(message: "Bad address for the Brain.")
        }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.setValue(secret, forHTTPHeaderField: "X-Brain-Secret")
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch let error as URLError where error.code == .timedOut {
            throw BrainAPIError(message: "The Brain took too long to answer.")
        } catch {
            throw BrainAPIError(message: "The Brain is not answering on port \(port). Is it running?")
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        switch status {
        case 200..<300: return data
        case 401: throw BrainAPIError(message: "The Brain refused this app's secret. It was probably started outside this app; stop it and start it here.")
        case 404: throw BrainAPIError(message: "This Brain is too old for that request (no \(path)).")
        default: throw BrainAPIError(message: "The Brain answered with an error (\(status)): \(String(decoding: data.prefix(300), as: UTF8.self))")
        }
    }

    func get(_ path: String) async throws -> JSON {
        try JSONDecoder().decode(JSON.self, from: try await request(path, timeout: 10))
    }

    /// Say something to the Nous and wait for its reply. Stays on this machine.
    func chat(_ text: String) async throws -> String {
        let data = try await request("/local/chat", body: ["text": text], timeout: 300)
        return try JSONDecoder().decode(JSON.self, from: data)["reply"].text
    }
}

/// The local model server (Ollama) on this machine. Asked directly, so the list works
/// whether or not the Brain is running.
enum LocalModels {
    struct Model: Identifiable, Equatable {
        let name: String
        let sizeBytes: Double
        let parameters: String
        var id: String { name }
    }

    static func installed(host: String) async throws -> [Model] {
        guard let url = URL(string: host.trimmingCharacters(in: .whitespaces) + "/api/tags") else {
            throw BrainAPIError(message: "The model server address is not valid.")
        }
        let data: Data
        do {
            (data, _) = try await URLSession.shared.data(for: URLRequest(url: url, timeoutInterval: 5))
        } catch {
            throw BrainAPIError(message: "No local model server is answering at \(host). Start Ollama, or check the address.")
        }
        let json = try JSONDecoder().decode(JSON.self, from: data)
        return json["models"].items.map {
            Model(name: $0["name"].text, sizeBytes: Double($0["size"].text) ?? 0, parameters: $0["details"]["parameter_size"].text)
        }
    }
}
