import AppKit
import SwiftUI

@main
struct NousMacApp: App {
    @StateObject private var app = AppModel()

    var body: some Scene {
        WindowGroup("Nous") {
            RootView()
                .environmentObject(app)
                .environmentObject(app.viewer)
                .environmentObject(app.brain)
                .environmentObject(app.account)
                .task { await app.restoreAccount() }
                .task { await app.keepAlive() }
                .frame(minWidth: 1040, minHeight: 660)
                .tint(coral)
                .onAppear {
                    NSApp.setActivationPolicy(.regular)
                    NSApp.activate(ignoringOtherApps: true)
                    // A configuration path may be given on the command line.
                    if let path = CommandLine.arguments.dropFirst().first(where: { !$0.hasPrefix("-") }) {
                        app.useConfig(at: path)
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: NSApplication.willTerminateNotification)) { _ in
                    app.quit()
                }
        }
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Choose Nous Configuration…") { app.chooseConfigFile() }.keyboardShortcut("o")
            }
        }
    }
}

/// The Rust core's view of the configured Nous at a chosen tick.
final class ViewerModel: ObservableObject {
    static let maxTick = 5000

    @Published private(set) var view: NousView?
    @Published private(set) var problem: String?
    @Published var tick: Double = 0 { didSet { if Int(tick) != Int(oldValue) { refresh() } } }

    private var yaml: String?

    /// Show the configuration at `path`; an empty path shows nothing.
    func load(path: String) {
        guard !path.isEmpty else {
            yaml = nil
            view = nil
            problem = nil
            return
        }
        do {
            yaml = try String(contentsOfFile: path, encoding: .utf8)
            if tick != 0 { tick = 0 } else { refresh() }
        } catch {
            yaml = nil
            view = nil
            problem = "Could not read \((path as NSString).lastPathComponent): \(error.localizedDescription)"
        }
    }

    private func refresh() {
        guard let yaml else { return }
        do {
            view = try BrainCore.view(yaml: yaml, tick: Int(tick))
            problem = nil
        } catch {
            view = nil
            problem = error.localizedDescription
        }
    }
}
