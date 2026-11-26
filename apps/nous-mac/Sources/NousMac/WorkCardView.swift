import SwiftUI

/// The end of a DID, for a line of text.
func shortDID(_ did: String) -> String {
    let tail = did.split(separator: ":").last.map(String.init) ?? did
    return tail.count > 18 ? "\(tail.prefix(8))…\(tail.suffix(6))" : tail
}

/// The nine stages in a row, the current one marked.
struct WorkTracker: View {
    let card: WorkCard

    var body: some View {
        HStack(spacing: 5) {
            ForEach(Array(WorkCard.loop.enumerated()), id: \.offset) { index, name in
                let n = index + 1
                let now = n == card.stageNumber && card.stage != "done"
                Text("\(n) \(name)\(n < card.stageNumber ? " ✓" : "")")
                    .font(.caption.weight(now ? .semibold : .regular))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(now ? coral : Color.secondary.opacity(n < card.stageNumber ? 0.18 : 0.06), in: Capsule())
                    .foregroundStyle(now ? Color.white : (n < card.stageNumber ? Color.primary : Color.secondary))
            }
        }
        .padding(.top, 4)
    }
}

/// A Work Card, stage by stage, as the Grid holds it. Read-only: this is what monitoring
/// a Work means. Every word shown comes from the card.
struct WorkMonitorView: View {
    let card: WorkCard

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            stage(2, "Goal", card) {
                row("Goal", card.goal)
                row("For whom", card.for_whom)
                row("Builder", short(card.builder))
                if let answer = card.answer {
                    row("Its answer", (answer.accepted ? "Accepted" : "Declined") + (answer.reason.isEmpty ? "" : " — \(answer.reason)") + " · tick \(answer.tick)")
                } else if card.owner != card.builder {
                    row("Its answer", "Asked; no answer yet.")
                }
            }
            stage(3, "Define", card) {
                if card.checks.isEmpty { notYet } else {
                    row("For what", card.for_what)
                    row("How", card.how)
                    if !card.which.isEmpty { row("Which", card.which.joined(separator: " · ")) }
                    numbered("Checks", card.checks)
                }
            }
            stage(4, "Plan", card) {
                if card.plan.isEmpty { notYet } else {
                    numbered(card.plan_approved ? "Plan · approved" : "Plan · waiting for your approval",
                             card.plan.map { "\($0.do) · by tick \($0.by_tick)" })
                }
            }
            stage(5, "Build", card, monitor: true) {
                if card.stageNumber < 5 { notYet } else {
                    numbered("Steps done: \(card.stepsDone) of \(card.plan.count)", card.plan.map { step in
                        (step.done ? "✓ " : "○ ") + step.do
                            + (step.done_tick.map { " · done at tick \($0)" } ?? "")
                            + (step.note.isEmpty ? "" : " — \(step.note)")
                    })
                }
            }
            stage(6, "Test", card, monitor: true) {
                if card.stageNumber < 6 { notYet } else {
                    numbered("Checks and evidence", card.checks.enumerated().map { index, check in
                        guard index < card.results.count, let result = card.results[index] else { return "\(check) — not recorded" }
                        return "\(check) — \(result.passed ? "passed" : "FAILED"): \(result.evidence) · tick \(result.tick)"
                    })
                }
            }
            stage(7, "Verify", card, monitor: true) {
                if let refusal = card.last_refusal {
                    row("Sent back to Test \(card.refusals)×, latest", "\(short(refusal.by)) — \(refusal.reason) · tick \(refusal.tick)")
                }
                if let verified = card.verified {
                    row("Confirmed by", "\(short(verified.by)) — \(verified.reason) · tick \(verified.tick)")
                } else if card.last_refusal == nil { notYet }
            }
            stage(8, "Deploy", card, monitor: true) {
                if let result = card.result {
                    row("Where it lives", result.where)
                    row("What it changed", result.changed)
                    row("Provenance", "Built by \(short(result.built_by)), verified by \(short(result.verified_by))"
                        + (result.built_from.isEmpty ? "" : ", from \(result.built_from.joined(separator: " · "))"))
                } else { notYet }
            }
            stage(9, "Notice", card, monitor: true) {
                if let notice = card.notice {
                    row("Goal information", notice.goal_info)
                    row("Guide", notice.guide)
                    row("Presentation", notice.presentation)
                } else { notYet }
            }
        }
    }

    private func stage(_ n: Int, _ name: String, _ card: WorkCard, monitor: Bool = false,
                       @ViewBuilder content: () -> some View) -> some View {
        let now = n == card.stageNumber && card.stage != "done" && card.stage != "declined"
        return VStack(alignment: .leading, spacing: 6) {
            Divider()
            HStack(spacing: 8) {
                Text("\(n)").font(.callout.monospaced()).foregroundStyle(now ? coral : .secondary)
                Text(name).font(.title3.weight(.medium))
                if now { Text("NOW").font(.caption2.weight(.semibold)).foregroundStyle(coral) }
                if monitor { Text("your Nous · monitoring only").font(.caption).foregroundStyle(.secondary) }
            }
            content()
        }
        .opacity(n > card.stageNumber || card.stage == "declined" && n > 2 ? 0.5 : 1)
    }

    private var notYet: some View { Text("Not yet.").foregroundStyle(.secondary) }

    private func row(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title.uppercased()).font(.caption2).foregroundStyle(.secondary)
            Text(value).textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func numbered(_ title: String, _ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased()).font(.caption2).foregroundStyle(.secondary)
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                Text("\(index + 1). \(item)").textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func short(_ did: String) -> String { shortDID(did) }
}
