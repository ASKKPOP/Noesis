/-
Model of the hybrid clocks in `protocol/src/knowledge.ts`.

A stamp is `HybridLogicalClock`: `wallTime`, `logical`, `nodeId`. A node id is a
string in the code, compared with `<`; here it is a number, which is the same
thing for ordering (any total order would do). `tick` is `tickHLC`, `receive`
is `receiveHLC`, `lt a b` is `compareHLC(a, b) < 0`. The physical clock reading
`pt` is `Date.now()`, passed in, and may be any number: clocks may disagree and
may go backward.

Nothing here is bounded: the theorems hold for every stamp and every clock reading.
-/

namespace HybridClock

structure Stamp where
  wallTime : Nat
  logical : Nat
  nodeId : Nat

/-- `compareHLC(a, b) < 0`: wall time, then logical counter, then node id. -/
def lt (a b : Stamp) : Prop :=
  a.wallTime < b.wallTime ∨
    (a.wallTime = b.wallTime ∧
      (a.logical < b.logical ∨ (a.logical = b.logical ∧ a.nodeId < b.nodeId)))

/-- Smaller by wall time and logical counter alone. -/
def ltWL (a b : Stamp) : Prop :=
  a.wallTime < b.wallTime ∨ (a.wallTime = b.wallTime ∧ a.logical < b.logical)

theorem eq_of_fields {a b : Stamp} (h1 : a.wallTime = b.wallTime)
    (h2 : a.logical = b.logical) (h3 : a.nodeId = b.nodeId) : a = b := by
  cases a; cases b; simp_all

theorem lt_irrefl (a : Stamp) : ¬ lt a a := by
  unfold lt; omega

theorem lt_asymm {a b : Stamp} (h : lt a b) : ¬ lt b a := by
  unfold lt at *; omega

theorem lt_trans {a b c : Stamp} (h1 : lt a b) (h2 : lt b c) : lt a c := by
  unfold lt at *; omega

/-- `a ≤ b` and `b ≤ c` give `a ≤ c`, written with "not smaller". -/
theorem not_lt_trans {a b c : Stamp} (h1 : ¬ lt b a) (h2 : ¬ lt c b) : ¬ lt c a := by
  unfold lt at *; omega

/-- P-HLC-01: stamps are in one strict total order: of any two, exactly one is
smaller or they are the same stamp (`lt_irrefl`, `lt_asymm`, `lt_trans` complete it). -/
theorem lt_trichotomy (a b : Stamp) : lt a b ∨ a = b ∨ lt b a := by
  by_cases h1 : a.wallTime = b.wallTime
  · by_cases h2 : a.logical = b.logical
    · by_cases h3 : a.nodeId = b.nodeId
      · exact Or.inr (Or.inl (eq_of_fields h1 h2 h3))
      · rcases Nat.lt_or_gt_of_ne h3 with h | h
        · exact Or.inl (by unfold lt; omega)
        · exact Or.inr (Or.inr (by unfold lt; omega))
    · rcases Nat.lt_or_gt_of_ne h2 with h | h
      · exact Or.inl (by unfold lt; omega)
      · exact Or.inr (Or.inr (by unfold lt; omega))
  · rcases Nat.lt_or_gt_of_ne h1 with h | h
    · exact Or.inl (by unfold lt; omega)
    · exact Or.inr (Or.inr (by unfold lt; omega))

/-- Two stamps neither of which is smaller are the same stamp. -/
theorem eq_of_not_lt {a b : Stamp} (h1 : ¬ lt a b) (h2 : ¬ lt b a) : a = b := by
  rcases lt_trichotomy a b with h | h | h
  · exact absurd h h1
  · exact h
  · exact absurd h h2

/-- `tickHLC(current)` with `Date.now() = pt`. -/
def tick (current : Stamp) (pt : Nat) : Stamp :=
  if pt > current.wallTime then
    { wallTime := pt, logical := 0, nodeId := current.nodeId }
  else
    { wallTime := current.wallTime, logical := current.logical + 1, nodeId := current.nodeId }

/-- `receiveHLC(local, remote)` with `Date.now() = pt`. -/
def receive (loc rem : Stamp) (pt : Nat) : Stamp :=
  { wallTime := max (max loc.wallTime rem.wallTime) pt
    logical :=
      if max (max loc.wallTime rem.wallTime) pt = loc.wallTime
          ∧ max (max loc.wallTime rem.wallTime) pt = rem.wallTime then
        max loc.logical rem.logical + 1
      else if max (max loc.wallTime rem.wallTime) pt = loc.wallTime then loc.logical + 1
      else if max (max loc.wallTime rem.wallTime) pt = rem.wallTime then rem.logical + 1
      else 0
    nodeId := loc.nodeId }

/-- The stamp of a local write on a card: `tickHLC` on the card's stamp, as the writing node. -/
def stampWrite (current : Stamp) (pt : Nat) (node : Nat) : Stamp :=
  { tick current pt with nodeId := node }

/-- P-HLC-02: a local tick gives a strictly larger stamp. -/
theorem tick_lt (current : Stamp) (pt : Nat) : lt current (tick current pt) := by
  unfold tick lt
  split <;> simp <;> omega

/-- P-HLC-03: a receive gives a stamp strictly larger than the local stamp ... -/
theorem receive_gt_local (loc rem : Stamp) (pt : Nat) : lt loc (receive loc rem pt) := by
  unfold receive lt
  simp only
  split
  · omega
  · split
    · omega
    · split <;> omega

/-- P-HLC-03: ... and strictly larger than the remote stamp, by wall time and logical counter. -/
theorem receive_gt_remote (loc rem : Stamp) (pt : Nat) : ltWL rem (receive loc rem pt) := by
  unfold receive ltWL
  simp only
  split
  · omega
  · split
    · omega
    · split <;> omega

/-- P-HLC-04: a ticked stamp's wall time is never behind the physical clock, and is
either the physical clock reading or the wall time it started from. -/
theorem tick_wall (current : Stamp) (pt : Nat) :
    pt ≤ (tick current pt).wallTime ∧
      ((tick current pt).wallTime = pt ∨ (tick current pt).wallTime = current.wallTime) := by
  unfold tick
  split <;> simp <;> omega

/-- P-HLC-04: a received stamp's wall time is never behind the physical clock, and is
the physical clock reading or one of the two wall times it was built from. -/
theorem receive_wall (loc rem : Stamp) (pt : Nat) :
    pt ≤ (receive loc rem pt).wallTime ∧
      ((receive loc rem pt).wallTime = pt ∨ (receive loc rem pt).wallTime = loc.wallTime
        ∨ (receive loc rem pt).wallTime = rem.wallTime) := by
  unfold receive
  simp only
  omega

/-- P-HLC-05 (the step): a write stamped from a stamp `current` is larger than every
stamp that is not larger than `current`, whichever node writes. -/
theorem stampWrite_gt (current x : Stamp) (pt node : Nat) (h : ¬ lt current x) :
    lt x (stampWrite current pt node) := by
  unfold stampWrite tick
  unfold lt at *
  split <;> simp <;> omega

end HybridClock

/-!
## Stamps from the network

A stamp arrives from a remote peer and may hold anything. Here a raw stamp has
`Int` fields, and a negative field stands for every value that is not a whole
number ≥ 0. `deliver` is the stamp `mergeCard` stores: an invalid stamp is
rejected, a valid one is kept if it is the larger.
-/

namespace HybridClockInput

structure RawStamp where
  wallTime : Int
  logical : Int
  nodeId : Nat

/-- `isValidHybridClock`. -/
def Valid (s : RawStamp) : Prop := 0 ≤ s.wallTime ∧ 0 ≤ s.logical

def lt (a b : RawStamp) : Prop :=
  a.wallTime < b.wallTime ∨
    (a.wallTime = b.wallTime ∧
      (a.logical < b.logical ∨ (a.logical = b.logical ∧ a.nodeId < b.nodeId)))

def tick (current : RawStamp) (pt : Int) : RawStamp :=
  if pt > current.wallTime then
    { wallTime := pt, logical := 0, nodeId := current.nodeId }
  else
    { wallTime := current.wallTime, logical := current.logical + 1, nodeId := current.nodeId }

open Classical in
/-- The stamp a replica stores after `mergeCard` is given a card stamped `m`. -/
noncomputable def deliver (loc m : RawStamp) : RawStamp :=
  if Valid m then (if lt loc m then m else loc) else loc

/-- P-CARD-06: a card whose stamp is not valid changes nothing. -/
theorem deliver_invalid (loc m : RawStamp) (h : ¬ Valid m) : deliver loc m = loc := by
  unfold deliver
  rw [if_neg h]

theorem tick_valid (current : RawStamp) (pt : Int) (h : Valid current) (hpt : 0 ≤ pt) :
    Valid (tick current pt) := by
  unfold tick Valid at *
  split <;> simp <;> omega

/-- A replica's stamp after any run of local ticks and deliveries of any stamps at all. -/
inductive Reachable : RawStamp → Prop
  | init (node : Nat) : Reachable { wallTime := 0, logical := 0, nodeId := node }
  | tick {s : RawStamp} (pt : Int) (hpt : 0 ≤ pt) : Reachable s → Reachable (tick s pt)
  | deliver {s : RawStamp} (m : RawStamp) : Reachable s → Reachable (deliver s m)

/-- P-CARD-06: every stored stamp is valid, whatever stamps arrive. -/
theorem stamps_valid {s : RawStamp} (h : Reachable s) : Valid s := by
  induction h with
  | init node => exact ⟨Int.le_refl 0, Int.le_refl 0⟩
  | tick pt hpt _ ih => exact tick_valid _ pt ih hpt
  | deliver m _ ih =>
    unfold deliver
    by_cases hv : Valid m
    · rw [if_pos hv]
      split
      · exact hv
      · exact ih
    · rw [if_neg hv]
      exact ih

end HybridClockInput

#print axioms HybridClock.lt_irrefl
#print axioms HybridClock.lt_asymm
#print axioms HybridClock.lt_trans
#print axioms HybridClock.lt_trichotomy
#print axioms HybridClock.tick_lt
#print axioms HybridClock.receive_gt_local
#print axioms HybridClock.receive_gt_remote
#print axioms HybridClock.tick_wall
#print axioms HybridClock.receive_wall
#print axioms HybridClock.stampWrite_gt
#print axioms HybridClockInput.deliver_invalid
#print axioms HybridClockInput.stamps_valid
