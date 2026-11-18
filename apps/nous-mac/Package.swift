// swift-tools-version:5.9
// The native Local Nous Manager (D-V3-42): a SwiftUI shell over the Rust Brain core.
import PackageDescription

let package = Package(
    name: "NousMac",
    platforms: [.macOS(.v14)],
    targets: [
        // The C interface of brain-rs (libnoesis_brain.a). Build it first: see build.sh.
        .target(name: "CNoesisBrain"),
        .executableTarget(
            name: "NousMac",
            dependencies: ["CNoesisBrain"],
            linkerSettings: [
                .unsafeFlags(["-L", "../../brain-rs/target/release"]),
                .linkedLibrary("noesis_brain"),
            ]
        ),
    ]
)
