import SwiftUI

/// Talk with your own Nous. The conversation stays on this machine: the Brain answers
/// through its local port and nothing is sent to a Grid.
struct ChatPane: View {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var brain: BrainProcess
    @State private var draft = ""
    @FocusState private var composing: Bool

    var body: some View {
        VStack(spacing: 0) {
            if app.messages.isEmpty {
                VStack(spacing: 10) {
                    Text("Talk with \(app.nousName)").font(.system(size: 30, weight: .semibold, design: .serif))
                    Text(brain.isRunning
                         ? "What you say here stays on this Mac. \(app.nousName) answers in character and remembers what you talk about."
                         : "Start the Brain to talk. What you say here stays on this Mac.")
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 460)
                    if !brain.isRunning {
                        Button("Start the Brain") { app.startBrain() }.buttonStyle(.borderedProminent).controlSize(.large)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(40)
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 18) {
                            ForEach(app.messages) { MessageRow(message: $0, nousName: app.nousName).id($0.id) }
                            if app.waitingForReply {
                                HStack(spacing: 8) {
                                    ProgressView().controlSize(.small)
                                    Text("\(app.nousName) is thinking…").foregroundStyle(.secondary)
                                }
                                .id("waiting")
                            }
                        }
                        .padding(.horizontal, 28)
                        .padding(.vertical, 20)
                        .frame(maxWidth: 760, alignment: .leading)
                        .frame(maxWidth: .infinity)
                    }
                    .onChange(of: app.messages.count) { _, _ in
                        withAnimation { proxy.scrollTo(app.waitingForReply ? "waiting" : app.messages.last?.id.uuidString ?? "", anchor: .bottom) }
                        if let last = app.messages.last { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                    .onAppear { if let last = app.messages.last { proxy.scrollTo(last.id, anchor: .bottom) } }
                }
            }
            composer
        }
        .toolbar {
            ToolbarItem {
                Button { app.clearChat() } label: { Label("Clear Conversation", systemImage: "trash") }
                    .disabled(app.messages.isEmpty || app.waitingForReply)
                    .help("Start a fresh conversation. The Nous keeps its memories of what was said.")
            }
        }
        .onAppear { composing = true }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Message \(app.nousName)", text: $draft, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...6)
                .focused($composing)
                .onSubmit(send)
                .accessibilityLabel("Message")
            Button(action: send) {
                Image(systemName: "arrow.up.circle.fill").font(.system(size: 24))
            }
            .buttonStyle(.plain)
            .foregroundStyle(canSend ? coral : Color.secondary.opacity(0.4))
            .disabled(!canSend)
            .keyboardShortcut(.return, modifiers: .command)
            .accessibilityLabel("Send")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.secondary.opacity(0.25)))
        .frame(maxWidth: 760)
        .padding(.horizontal, 28)
        .padding(.bottom, 20)
        .padding(.top, 8)
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !app.waitingForReply
    }

    private func send() {
        guard canSend else { return }
        app.send(draft)
        draft = ""
    }
}

private struct MessageRow: View {
    let message: ChatMessage
    let nousName: String

    var body: some View {
        switch message.role {
        case .human:
            HStack {
                Spacer(minLength: 80)
                Text(message.text)
                    .textSelection(.enabled)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(Color.secondary.opacity(0.16), in: RoundedRectangle(cornerRadius: 14))
            }
        case .nous:
            VStack(alignment: .leading, spacing: 4) {
                Text(nousName).font(.caption.weight(.semibold)).foregroundStyle(coral)
                Text(message.text).font(.system(.body, design: .serif)).lineSpacing(3).textSelection(.enabled)
            }
        case .problem:
            Label(message.text, systemImage: "exclamationmark.triangle")
                .font(.callout)
                .foregroundStyle(coral)
                .textSelection(.enabled)
        }
    }
}
