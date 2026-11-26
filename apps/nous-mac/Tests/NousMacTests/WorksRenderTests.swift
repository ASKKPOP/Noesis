import SwiftUI
import XCTest
@testable import NousMac

/// Draws the Works screen's monitoring view for each card into a PNG, so a report can show
/// exactly what the app shows. Skipped unless WORKS_RENDER_DIR (a folder of cards as JSON) and
/// WORKS_RENDER_OUT (the folder for the PNGs) are set.
@MainActor
final class WorksRenderTests: XCTestCase {
    func testTheMonitoringViewDrawsEachCard() throws {
        let env = ProcessInfo.processInfo.environment
        guard let source = env["WORKS_RENDER_DIR"], let out = env["WORKS_RENDER_OUT"] else {
            throw XCTSkip("WORKS_RENDER_DIR is not set")
        }
        let files = try FileManager.default.contentsOfDirectory(atPath: source).filter { $0.hasSuffix(".json") }.sorted()
        XCTAssertFalse(files.isEmpty)
        for file in files {
            let card = try JSONDecoder().decode(WorkCard.self, from: Data(contentsOf: URL(fileURLWithPath: source).appendingPathComponent(file)))
            let view = VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(card.goal).font(.title2.weight(.semibold))
                    Text("\(card.standing) · version \(card.version) · last change at tick \(card.updated_tick)")
                        .font(.callout).foregroundStyle(.secondary)
                    WorkTracker(card: card)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("YOUR STEP").font(.caption2).foregroundStyle(.secondary)
                    Text(card.waitingFor).foregroundStyle(.secondary)
                }
                WorkMonitorView(card: card)
            }
            .padding(24)
            .frame(width: 780, alignment: .leading)
            .background(Color.white)
            .environment(\.colorScheme, .light)

            let renderer = ImageRenderer(content: view)
            renderer.scale = 2
            let image = try XCTUnwrap(renderer.nsImage)
            let bitmap = try XCTUnwrap(NSBitmapImageRep(data: try XCTUnwrap(image.tiffRepresentation)))
            let name = "mac-" + file.replacingOccurrences(of: ".json", with: ".png")
            try XCTUnwrap(bitmap.representation(using: .png, properties: [:]))
                .write(to: URL(fileURLWithPath: out).appendingPathComponent(name))
            XCTAssertGreaterThan(image.size.height, 300, file)
        }
    }
}
