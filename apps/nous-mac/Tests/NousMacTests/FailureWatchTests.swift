import XCTest
@testable import NousMac

final class FailureWatchTests: XCTestCase {
    func testTellsTheUserOnceAfterFiveFailuresInARow() {
        var watch = FailureWatch()
        let told = (1...8).map { _ in watch.failed() }
        XCTAssertEqual(told, [false, false, false, false, true, false, false, false])
    }

    func testRecoveryStartsANewCount() {
        var watch = FailureWatch()
        for _ in 1...4 { _ = watch.failed() }
        XCTAssertFalse(watch.recovered(), "nobody was told, so there is nothing to take back")
        XCTAssertEqual(watch.failures, 0)
        let told = (1...5).map { _ in watch.failed() }
        XCTAssertEqual(told.last, true)
        XCTAssertTrue(watch.recovered(), "the user was told it was down")
    }

    func testWaitsLongerEachTimeAndNeverStops() {
        var watch = FailureWatch()
        var delays: [TimeInterval] = []
        for _ in 1...8 { _ = watch.failed(); delays.append(watch.retryDelay) }
        XCTAssertEqual(delays, [2, 4, 8, 16, 32, 60, 60, 60])
    }
}
