/-
Model of the vector clocks in `protocol/src/knowledge.ts`.

A clock in the code is a `Record<string, number>` where a missing entry reads
as 0. Here a clock is a total function `Node → Nat`, which is the same thing
with every entry present. `merge` is `mergeVectorClocks`; `tick` is
`vectorClock[did] = (vectorClock[did] || 0) + 1`.

Nothing here is bounded: the theorems hold for any set of nodes and any counts.
-/

namespace VectorClock

abbrev Clock (Node : Type) := Node → Nat

variable {Node : Type}

/-- `mergeVectorClocks(a, b)`: the larger count, node by node. -/
def merge (a b : Clock Node) : Clock Node := fun n => max (a n) (b n)

/-- `a` is at most `b` at every node. -/
def le (a b : Clock Node) : Prop := ∀ n, a n ≤ b n

/-- P-VCLOCK-01: merging two clocks gives the same result in either order. -/
theorem merge_comm (a b : Clock Node) : merge a b = merge b a := by
  funext n
  exact Nat.max_comm (a n) (b n)

/-- P-VCLOCK-02: merging three clocks gives the same result however they are grouped. -/
theorem merge_assoc (a b c : Clock Node) :
    merge (merge a b) c = merge a (merge b c) := by
  funext n
  exact Nat.max_assoc (a n) (b n) (c n)

/-- P-VCLOCK-03: merging a clock with itself changes nothing. -/
theorem merge_idem (a : Clock Node) : merge a a = a := by
  funext n
  exact Nat.max_self (a n)

/-- P-VCLOCK-04: a merge is at least as large as both inputs. -/
theorem merge_upper_bound (a b : Clock Node) :
    le a (merge a b) ∧ le b (merge a b) :=
  ⟨fun n => Nat.le_max_left (a n) (b n), fun n => Nat.le_max_right (a n) (b n)⟩

/-- P-VCLOCK-04 (strengthened): the merge is the *smallest* clock above both inputs. -/
theorem merge_least (a b c : Clock Node) (ha : le a c) (hb : le b c) :
    le (merge a b) c :=
  fun n => Nat.max_le.mpr ⟨ha n, hb n⟩

/-! ## The system: replicas that tick and receive -/

/-- `s r n` is what replica `r` knows of replica `n`'s count. -/
abbrev State (Node : Type) := Node → Clock Node

variable [DecidableEq Node]

def init : State Node := fun _ _ => 0

/-- Replica `r` increments its own entry. -/
def tick (s : State Node) (r : Node) : State Node :=
  fun x => if x = r then (fun n => if n = r then s r r + 1 else s r n) else s x

/-- Replica `r` merges in replica `q`'s clock. -/
def receive (s : State Node) (r q : Node) : State Node :=
  fun x => if x = r then merge (s r) (s q) else s x

inductive Step : State Node → State Node → Prop
  | tick (s : State Node) (r : Node) : Step s (tick s r)
  | receive (s : State Node) (r q : Node) : Step s (receive s r q)

inductive Reachable : State Node → Prop
  | init : Reachable init
  | step {s t : State Node} : Reachable s → Step s t → Reachable t

/-- No replica knows a higher count for `r` than `r` itself holds. -/
def NoFutureKnowledge (s : State Node) : Prop := ∀ r q, s q r ≤ s r r

theorem noFuture_step {s t : State Node}
    (h : NoFutureKnowledge s) (st : Step s t) : NoFutureKnowledge t := by
  intro a q
  cases st with
  | tick r =>
    have h1 := h a q
    have h2 := h a r
    simp only [tick]
    by_cases hq : q = r <;> by_cases ha : a = r <;> simp [hq, ha] <;> subst_vars <;> omega
  | receive r p =>
    have h1 := h a q
    have h2 := h a r
    have h3 := h a p
    have h4 := h a a
    simp only [receive]
    by_cases hq : q = r <;> by_cases ha : a = r <;> simp [hq, ha, merge] <;> subst_vars <;> omega

/-- P-VCLOCK-05: in every reachable state, no replica knows a higher count for
replica `r` than `r` itself holds. -/
theorem noFuture_reachable {s : State Node} (h : Reachable s) : NoFutureKnowledge s := by
  induction h with
  | init => intro _ _; exact Nat.le_refl 0
  | step _ st ih => exact noFuture_step ih st

/-- P-VCLOCK-06: a replica's clock never goes backward. -/
theorem step_never_backward {s t : State Node} (st : Step s t) (r : Node) :
    le (s r) (t r) := by
  intro n
  cases st with
  | tick q =>
    simp only [tick]
    by_cases hr : r = q <;> by_cases hn : n = q <;> simp [hr, hn] <;> subst_vars <;> omega
  | receive q p =>
    simp only [receive]
    by_cases hr : r = q <;> simp [hr, merge] <;> subst_vars <;> omega

end VectorClock

#print axioms VectorClock.merge_comm
#print axioms VectorClock.merge_assoc
#print axioms VectorClock.merge_idem
#print axioms VectorClock.merge_upper_bound
#print axioms VectorClock.merge_least
#print axioms VectorClock.noFuture_reachable
#print axioms VectorClock.step_never_backward
