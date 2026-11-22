import Foundation
import UserNotifications

/// Counts failures in a row for one thing that must stay up (the Brain process, or the
/// local model server), says how long to wait before trying again, and says once per
/// outage when the user should be told.
struct FailureWatch: Equatable {
    /// Failures in a row before the user is told.
    static let alertAfter = 5
    /// A Brain that stayed up this long had started properly; the next exit is a new outage.
    static let settledAfter: TimeInterval = 60

    private(set) var failures = 0
    private var told = false

    /// Record a failure. True when this is the failure the user should be told about.
    mutating func failed() -> Bool {
        failures += 1
        guard failures >= Self.alertAfter, !told else { return false }
        told = true
        return true
    }

    /// It works again. True when the user had been told it was down.
    @discardableResult
    mutating func recovered() -> Bool {
        defer { self = FailureWatch() }
        return told
    }

    /// Seconds to wait before the next try: 2, 4, 8, 16, 32, then every 60. It never gives up.
    var retryDelay: TimeInterval { min(60, pow(2, Double(max(1, failures)))) }
}

/// Messages to the user from this Mac's Notification Center.
enum Alerts {
    /// Notifications need the app bundle; a bare test or command-line run has none.
    private static var available: Bool { Bundle.main.bundleIdentifier != nil }

    static func askPermission() {
        guard available else { return }
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    static func send(title: String, message: String) {
        guard available else { return }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = message
        content.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
    }
}
