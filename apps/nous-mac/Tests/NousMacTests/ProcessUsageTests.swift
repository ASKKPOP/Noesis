import XCTest
@testable import NousMac

final class ProcessUsageTests: XCTestCase {
    private let ps = """
      0.0  32416 /opt/homebrew/opt/ollama/bin/ollama
    469.8 78557232 /Applications/Ollama.app/Contents/Resources/llama-server
      0.1 18463440 /Applications/Ollama.app/Contents/Resources/llama-server
     12.0   500000 /Applications/Safari.app/Contents/MacOS/Safari
      1.5    40000 /Applications/Some App/With Spaces/tool
    """

    func testAddsUpOnlyTheModelServersProcesses() throws {
        let total = try XCTUnwrap(ProcessUsage.total(psOutput: ps, marker: "ollama", cores: 10))
        XCTAssertEqual(total.cpuPercent, 46.99, accuracy: 0.001)   // 469.9% of one core over 10 cores
        XCTAssertEqual(total.memoryBytes, (32416 + 78557232 + 18463440) * 1024)
    }

    func testNeverReportsMoreThanTheWholeMac() throws {
        let total = try XCTUnwrap(ProcessUsage.total(psOutput: "950.0 1000 /x/ollama", marker: "ollama", cores: 8))
        XCTAssertEqual(total.cpuPercent, 100)
    }

    func testNoModelServerProcessMeansNothingToReport() {
        XCTAssertNil(ProcessUsage.total(psOutput: "12.0 500000 /Applications/Safari.app/Contents/MacOS/Safari", marker: "ollama", cores: 8))
    }
}
