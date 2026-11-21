import CryptoKit
import SwiftUI

/// What the Grid knows this Nous by, read from the Brain's own data directory.
/// The Brain makes the key (brain/src/noesis_brain/wire/enrollment.py); this app only
/// reads it to show the public half. The private key never leaves the file.
struct GridIdentity: Equatable {
    let nousDID: String
    /// The Brain's public key as the Portal asks for it; nil until the Brain has made its key.
    let publicKey: String?
    /// The Civic-DID the Grid issued; nil until the registration is approved.
    let civicDID: String?

    init(settings: AppSettings, nousName: String) {
        let slug = nousName.lowercased()
            .replacingOccurrences(of: "[^a-z0-9_-]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        nousDID = settings.environment["NOUS_DID"] ?? "did:noesis:\(slug)"
        let dir = settings.brainDataDir
        if let seed = try? Data(contentsOf: dir.appendingPathComponent("brain-wire.key")),
           let key = try? Curve25519.Signing.PrivateKey(rawRepresentation: seed) {
            publicKey = key.publicKey.rawRepresentation.base64EncodedString()
                .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")
        } else {
            publicKey = nil
        }
        let issued = (try? String(contentsOf: dir.appendingPathComponent("civic-did"), encoding: .utf8))?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        civicDID = issued?.isEmpty == false ? issued : nil
    }
}

/// Joining a Grid as this Nous: the Grid's address, what to register on the Portal, and
/// where the registration stands. Citizenship itself is decided by the Portal and the
/// Grid's Polis; this screen only prepares and shows it.
struct GridAccessPane: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var brain: BrainProcess
    @State private var identity: GridIdentity?

    @EnvironmentObject private var account: GridAccount
    @State private var email = ""
    @State private var password = ""

    private var gridProblem: String? {
        app.settings.grid == nil ? "A Grid address must start with https://. The Brain refuses any other." : nil
    }
    private var portal: URL? { URL(string: app.settings.mapURL.trimmingCharacters(in: .whitespaces)) }

    var body: some View {
        Form {
            Section {
                TextField("Grid address", text: $app.settings.gridURL, prompt: Text("https://api.noesiis.com"))
                if let gridProblem {
                    Label(gridProblem, systemImage: "exclamationmark.triangle").foregroundStyle(coral)
                }
                Toggle("This Nous joins the Grid", isOn: $app.settings.joinGrid)
            } header: {
                Text("Grid")
            } footer: {
                Text(app.settings.joinGrid
                     ? "Used the next time the Brain starts. Until its registration is approved the Brain waits there and does not think or chat."
                     : "Off: this Nous runs on its own and reaches no Grid. Your account below works either way.")
            }
            accountSection
            if let identity {
                Section {
                    LabeledContent("Status", value: status(identity))
                    if let civic = identity.civicDID { copyRow("Civic-DID", civic) }
                } header: {
                    Text("Citizenship")
                }
                Section {
                    copyRow("Nous ID", identity.nousDID)
                    if let key = identity.publicKey {
                        copyRow("Brain public key", key)
                    } else {
                        LabeledContent("Brain public key", value: "Not made yet")
                    }
                } header: {
                    Text("What to register")
                } footer: {
                    Text(identity.publicKey == nil
                         ? "The Brain makes its key the first time it starts with a Grid address. Set the address, start the Brain, then come back here."
                         : "The private half of this key stays in the Brain's data folder on this Mac.")
                }
            }
            Section {
                Button("Open Nous Registration") { show("/portal/dashboard") }
            } header: {
                Text("On the Portal")
            } footer: {
                Text("Signed in with your account above, file the registration with the Nous ID and Brain public key above. A Portal reviewer and the Grid's Polis decide; the Brain picks up its Civic-DID by itself once approved.")
            }
            .disabled(portal == nil)
        }
        .formStyle(.grouped)
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
        .task(id: brain.isRunning) {
            // The key and the Civic-DID appear while the Brain runs; keep looking.
            repeat {
                identity = GridIdentity(settings: app.settings, nousName: app.nousName)
                try? await Task.sleep(for: .seconds(5))
            } while !Task.isCancelled && brain.isRunning
        }
        .onChange(of: app.settings) { _, _ in identity = GridIdentity(settings: app.settings, nousName: app.nousName) }
    }

    @ViewBuilder private var accountSection: some View {
        Section {
            if case .signedIn(let did) = account.state {
                LabeledContent("Signed in as", value: app.settings.accountEmail)
                copyRow("Your ID", did)
                Button("Sign Out") {
                    Task {
                        if let grid = app.settings.grid { await account.signOut(email: app.settings.accountEmail, grid: grid) }
                        app.settings.accountEmail = ""
                    }
                }
            } else {
                TextField("Email", text: $email).textContentType(.username)
                SecureField("Password", text: $password).textContentType(.password).onSubmit(signIn)
                if case .failed(let reason) = account.state {
                    Label(reason, systemImage: "exclamationmark.triangle").foregroundStyle(coral)
                }
                HStack {
                    Button("Sign In", action: signIn)
                        .buttonStyle(.borderedProminent)
                        .disabled(email.isEmpty || password.isEmpty || app.settings.grid == nil || account.state == .signingIn)
                    if account.state == .signingIn { ProgressView().controlSize(.small) }
                    Spacer()
                    Button("Create an Account…") { show("/portal/auth") }.disabled(portal == nil)
                }
            }
        } header: {
            Text("Your account")
        } footer: {
            Text("Sign in once. Your password is kept in this Mac's Keychain, and the app signs in again by itself, so the Map and the Portal always open signed in. Sign Out forgets it.")
        }
        .onAppear { if email.isEmpty { email = app.settings.accountEmail } }
    }

    private func signIn() {
        guard let grid = app.settings.grid, !email.isEmpty, !password.isEmpty else { return }
        let (address, secret) = (email.trimmingCharacters(in: .whitespaces), password)
        Task {
            if await account.signIn(email: address, password: secret, grid: grid) {
                app.settings.accountEmail = address
                password = ""
            }
        }
    }

    private func status(_ identity: GridIdentity) -> String {
        if identity.civicDID != nil { return "Citizen" }
        if !app.settings.joinGrid { return "Not joining a Grid" }
        if identity.publicKey == nil { return "Not started" }
        return brain.isRunning ? "Waiting for approval" : "Not yet a citizen"
    }

    private func copyRow(_ title: String, _ value: String) -> some View {
        LabeledContent(title) {
            HStack {
                Text(value).font(.system(.callout, design: .monospaced)).textSelection(.enabled).lineLimit(1).truncationMode(.middle)
                Button("Copy") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(value, forType: .string)
                }
                .accessibilityLabel("Copy \(title)")
            }
        }
    }

    private func show(_ path: String) {
        guard let portal else { return }
        app.map.open(MapBrowser.page(path, on: portal))
        app.pane = .map
    }
}
