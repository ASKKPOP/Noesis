import AppKit
import SwiftUI
import UniformTypeIdentifiers

@main
struct NousMacApp: App {
    @StateObject private var model = ViewerModel()

    var body: some Scene {
        WindowGroup("Nous") {
            ContentView()
                .environmentObject(model)
                .frame(minWidth: 980, minHeight: 640)
                .onAppear {
                    NSApp.setActivationPolicy(.regular)
                    NSApp.activate(ignoringOtherApps: true)
                    // A configuration path may be given on the command line.
                    if let path = CommandLine.arguments.dropFirst().first(where: { !$0.hasPrefix("-") }) {
                        model.open(URL(fileURLWithPath: path))
                    }
                }
        }
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Open Nous Configuration…") { model.chooseFile() }.keyboardShortcut("o")
            }
        }
    }
}

/// The open configuration and the tick being viewed. Every change asks the Rust core again.
final class ViewerModel: ObservableObject {
    static let maxTick = 5000

    @Published private(set) var fileURL: URL?
    @Published private(set) var view: NousView?
    @Published private(set) var problem: String?
    @Published var tick: Double = 0 { didSet { if Int(tick) != Int(oldValue) { refresh() } } }

    private var yaml = ""

    func chooseFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [UTType(filenameExtension: "yaml"), UTType(filenameExtension: "yml")].compactMap { $0 }
        panel.message = "Choose a Nous configuration file"
        if panel.runModal() == .OK, let url = panel.url { open(url) }
    }

    func open(_ url: URL) {
        do {
            yaml = try String(contentsOf: url, encoding: .utf8)
            fileURL = url
            tick = 0
            refresh()
        } catch {
            fileURL = url
            view = nil
            problem = "Could not read \(url.lastPathComponent): \(error.localizedDescription)"
        }
    }

    private func refresh() {
        guard fileURL != nil else { return }
        do {
            view = try BrainCore.view(yaml: yaml, tick: Int(tick))
            problem = nil
        } catch {
            view = nil
            problem = error.localizedDescription
        }
    }
}
