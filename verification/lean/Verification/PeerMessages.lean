/-
Model of how a direct message from one Nous reaches another Nous's Brain.

  grid/src/integration/peer-messages.ts            `checkPeerMessage`, `PeerMessageRouter.deliver`
  grid/src/integration/nous-runner.ts              `case 'direct_message'` (audit payload)
  grid/src/civic-presence/message-queue-store.ts   `enqueue`, `markDelivered`
  brain/src/noesis_brain/rpc/handler.py            `_run_peer_inbox_cycle`

The Grid keeps one row per message id. A row is `pending` until the target's Brain
claims it; the claim flips it to `delivered`, and only a claim that flipped the row
lets the Brain hand the message to `on_message`. `handed` counts those hand-overs.

`route` is the sender side (the runner plus the router). `claim` is one
`PATCH /civic/inbox/ack` with a single id, from any caller, for any id.

Nothing here is bounded: the theorems hold for any DIDs, any ids and any sequence
of sends and claims. The inbox size cap and the scrubbing of a claimed row's text
are not modelled here (see `verification/PROPERTIES.md`, stated limits).
-/

namespace PeerMessages

variable {Did : Type} [DecidableEq Did]

/-- One queue row: not there, waiting for `to`, or already claimed by `to`. -/
inductive Slot (Did : Type) where
  | empty
  | pending (to : Did)
  | delivered (to : Did)

/-- The Grid's queue and the count of hand-overs to `on_message`, both by message id. -/
structure Grid (Did : Type) where
  slot : Nat → Slot Did
  handed : Nat → Nat

def Grid.init : Grid Did := ⟨fun _ => .empty, fun _ => 0⟩

/-- What the Grid knows when a Brain posts a direct message. -/
structure Send (Did : Type) where
  sender : Did
  target : Did
  len : Nat
  muted : Bool
  senderGood : Bool
  targetGood : Bool

/-- `PEER_MESSAGE_MAX_CHARS`. -/
def maxChars : Nat := 16384

/-- The checks before a message is queued: sender not muted, target is another Nous,
both in good standing, text not empty and not over the limit. -/
def accepts (m : Send Did) : Bool :=
  !m.muted && decide (m.target ≠ m.sender) && m.senderGood && m.targetGood
    && decide (0 < m.len) && decide (m.len ≤ maxChars)

/-- Sender side: queue `m` under `id` if it passes the checks and the id is unused. -/
def route (g : Grid Did) (id : Nat) (m : Send Did) : Grid Did :=
  match accepts m, g.slot id with
  | true, .empty => { g with slot := fun i => if i = id then .pending m.target else g.slot i }
  | _, _ => g

/-- One ack: flips the row only if it is pending and addressed to the caller. The flag is
what the Grid answers; the Brain hands the message over only when it is `true`. -/
def claim (g : Grid Did) (caller : Did) (id : Nat) : Grid Did × Bool :=
  match g.slot id with
  | .pending to =>
      if to = caller then
        ({ slot := fun i => if i = id then .delivered to else g.slot i,
           handed := fun i => if i = id then g.handed i + 1 else g.handed i }, true)
      else (g, false)
  | _ => (g, false)

inductive Op (Did : Type) where
  | route (id : Nat) (m : Send Did)
  | claim (caller : Did) (id : Nat)

def step (g : Grid Did) : Op Did → Grid Did
  | .route id m => route g id m
  | .claim c id => (claim g c id).1

def run (g : Grid Did) (ops : List (Op Did)) : Grid Did := ops.foldl step g

/-- The audit record of a direct message, next to the message itself. -/
structure Msg (Did : Type) where
  sender : Did
  target : Did
  channel : String
  tick : Nat
  text : String

/-- The `nous.direct_message` payload: `{ targetDid, channel, tick }`. -/
def auditOf (m : Msg Did) : Did × String × Nat := (m.target, m.channel, m.tick)

/-! ## The invariant: a row is handed over exactly when it is delivered -/

def expected : Slot Did → Nat
  | .delivered _ => 1
  | _ => 0

def Inv (g : Grid Did) : Prop := ∀ i, g.handed i = expected (g.slot i)

omit [DecidableEq Did] in
theorem init_inv : Inv (Grid.init : Grid Did) := fun _ => rfl

theorem route_inv {g : Grid Did} (h : Inv g) (id : Nat) (m : Send Did) : Inv (route g id m) := by
  intro i
  unfold route
  split
  · rename_i _ hs
    by_cases hi : i = id
    · subst hi
      have := h i
      simp [expected, hs] at this ⊢
      exact this
    · simpa [hi] using h i
  · exact h i

theorem claim_inv {g : Grid Did} (h : Inv g) (c : Did) (id : Nat) : Inv (claim g c id).1 := by
  intro i
  unfold claim
  split
  · rename_i to hs
    split
    · by_cases hi : i = id
      · subst hi
        have := h i
        simp [expected, hs] at this ⊢
        exact this
      · simpa [hi] using h i
    · exact h i
  · exact h i

theorem step_inv {g : Grid Did} (h : Inv g) (op : Op Did) : Inv (step g op) := by
  cases op with
  | route id m => exact route_inv h id m
  | claim c id => exact claim_inv h c id

theorem run_inv {g : Grid Did} (h : Inv g) (ops : List (Op Did)) : Inv (run g ops) := by
  induction ops generalizing g with
  | nil => exact h
  | cons op rest ih => exact ih (step_inv h op)

/-! ## The registered properties -/

/-- P-DM-01: after any sequence of sends and claims — repeated polls, several Brain
processes, restarts — no message has been handed to `on_message` more than once. -/
theorem handed_at_most_once (ops : List (Op Did)) (i : Nat) :
    (run (Grid.init : Grid Did) ops).handed i ≤ 1 := by
  have h := run_inv (init_inv (Did := Did)) ops i
  rw [h]
  cases (run (Grid.init : Grid Did) ops).slot i <;> simp [expected]

/-- P-DM-02: the Grid answers "claimed" only to the Nous the message was addressed to. -/
theorem claim_only_by_target {g : Grid Did} {caller : Did} {id : Nat}
    (h : (claim g caller id).2 = true) : g.slot id = .pending caller := by
  unfold claim at h
  split at h
  · rename_i to hs
    split at h
    · rename_i heq
      rw [hs, heq]
    · cases h
  · cases h

/-- P-DM-03: a message from a muted sender changes nothing: it is never queued. -/
theorem muted_routes_nothing (g : Grid Did) (id : Nat) (m : Send Did) (h : m.muted = true) :
    route g id m = g := by
  have ha : accepts m = false := by simp [accepts, h]
  unfold route
  split
  · rename_i hacc _
    rw [ha] at hacc
    cases hacc
  · rfl

/-- P-DM-04: a send that put a row in the queue passed every check — the target is another
Nous, sender and target are in good standing, and the text is neither empty nor too long. -/
theorem queued_only_if_accepted {g : Grid Did} {id : Nat} {m : Send Did} {t : Did}
    (hempty : g.slot id = .empty) (h : (route g id m).slot id = .pending t) :
    t = m.target ∧ m.muted = false ∧ m.target ≠ m.sender ∧ m.senderGood = true
      ∧ m.targetGood = true ∧ 0 < m.len ∧ m.len ≤ maxChars := by
  unfold route at h
  split at h
  · rename_i hacc _
    have ht : t = m.target := by
      simp at h
      exact h.symm
    simp [accepts] at hacc
    obtain ⟨⟨⟨⟨⟨h1, h2⟩, h3⟩, h4⟩, h5⟩, h6⟩ := hacc
    exact ⟨ht, h1, h2, h3, h4, h5, h6⟩
  · rw [hempty] at h
    cases h

omit [DecidableEq Did] in
/-- P-DM-05: the audit record does not depend on the message text — two messages that
differ only in their text leave the same record. -/
theorem audit_ignores_text (m : Msg Did) (t : String) :
    auditOf { m with text := t } = auditOf m := rfl

/-- P-DM-06 (the step that makes progress): when the target's Brain claims a message
that is waiting for it, the claim succeeds and the row is delivered. -/
theorem pending_claim_succeeds {g : Grid Did} {caller : Did} {id : Nat}
    (h : g.slot id = .pending caller) :
    (claim g caller id).2 = true ∧ ∃ t, (claim g caller id).1.slot id = .delivered t := by
  unfold claim
  rw [h]
  simp

end PeerMessages

#print axioms PeerMessages.handed_at_most_once
#print axioms PeerMessages.claim_only_by_target
#print axioms PeerMessages.muted_routes_nothing
#print axioms PeerMessages.queued_only_if_accepted
#print axioms PeerMessages.audit_ignores_text
#print axioms PeerMessages.pending_claim_succeeds
