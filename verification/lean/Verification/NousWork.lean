/-
Model of a Nous's part in a Work: which step its Brain picks, what it sends.

  brain/src/noesis_brain/work_logic.py    `my_step`, `parse_answer`, `parse_verify`, …
  brain/src/noesis_brain/work_cycle.py    `WorkCycle.run` (one write, on the version read)

The Grid's side is `Verification/Work.lean`; the theorems here tie the Brain's choice to
the Grid's role table (`Work.allowed`) and its write to the Grid's version check
(`Work.write`). Text is a length: what the model said is "no reason" (0) or a reason of
some length after trimming. Whether the model's judgement is right is not modelled.
-/
import Verification.Work

namespace NousWork

open Work

variable {Did : Type} [DecidableEq Did]

/-- The steps a Nous takes (`STEP_ROUTE`). -/
inductive Step where
  | answer | build | test | verify | deploy | notice
  deriving DecidableEq, Repr

/-- `my_step`: the builder answers, builds, tests, deploys and announces its own Work; a
Nous verifies only a Work it does not build; Define and Plan are left to the owner. -/
def myStep (stage : Stage) (builder me : Did) : Option Step :=
  if stage = .verify then
    if builder ≠ me then some .verify else none
  else if builder ≠ me then none
  else match stage with
    | .goal => some .answer
    | .build => some .build
    | .test => some .test
    | .deploy => some .deploy
    | .notice => some .notice
    | _ => none

/-- The Grid operation a step is sent as, whatever its content. -/
def opOf : Step → Bool → Nat → Op
  | .answer, b, _ => .answer b
  | .build, _, n => .completeStep n
  | .test, b, n => .recordCheck n b
  | .verify, b, _ => .verify b
  | .deploy, _, _ => .deploy
  | .notice, _, _ => .announce

/-- P-NOUSWORK-01: the step the Brain picks is one the Grid's role table allows this
Nous, in the card's stage, whatever the step then says. -/
theorem picked_step_is_allowed (c : Card Did) (me : Did) (s : Step)
    (h : myStep c.stage c.builder me = some s) (b : Bool) (n : Nat) :
    allowed c me true (opOf s b n) := by
  unfold myStep at h
  by_cases hv : c.stage = .verify
  · simp [hv] at h
    obtain ⟨hne, rfl⟩ := h
    exact ⟨hv, fun e => hne e.symm, rfl⟩
  · simp [hv] at h
    obtain ⟨hb, hm⟩ := h
    cases hs : c.stage <;> simp [hs] at hm hv <;> subst hm <;> simp [opOf, allowed, hs, hb]

/-- P-NOUSWORK-01: no step on a Work that is being defined or planned, or is finished. -/
theorem no_step_outside_the_nous_stages (stage : Stage) (builder me : Did)
    (h : stage = .define ∨ stage = .plan ∨ stage = .done ∨ stage = .declined) :
    myStep stage builder me = none := by
  rcases h with h | h | h | h <;> subst h <;> by_cases hb : builder = me <;> simp [myStep, hb]

/-- `FIELD_MAX`. -/
def fieldMax : Nat := 1000

/-- `parse_verify`: a verdict and a reason, cut to the limit; nothing without both. -/
def parseVerify (confirm : Option Bool) (reasonLen : Nat) : Option (Bool × Nat) :=
  match confirm with
  | none => none
  | some b => if reasonLen = 0 then none else some (b, min reasonLen fieldMax)

/-- `parse_answer`: accepting may come without a reason; declining may not. -/
def parseAnswer (accept : Option Bool) (reasonLen : Nat) : Option (Bool × Nat) :=
  match accept with
  | none => none
  | some true => some (true, min reasonLen fieldMax)
  | some false => if reasonLen = 0 then none else some (false, min reasonLen fieldMax)

/-- P-NOUSWORK-02: a verify the Brain sends has a verdict and a reason of 1 to 1,000
characters, whatever the model said. -/
theorem verify_body_is_well_formed (confirm : Option Bool) (reasonLen : Nat) (b : Bool) (len : Nat)
    (h : parseVerify confirm reasonLen = some (b, len)) : 1 ≤ len ∧ len ≤ fieldMax := by
  unfold parseVerify at h
  cases confirm with
  | none => simp at h
  | some v =>
    by_cases hz : reasonLen = 0
    · simp [hz] at h
    · simp [hz] at h
      obtain ⟨_, rfl⟩ := h
      simp [fieldMax, Nat.le_min]
      omega

/-- P-NOUSWORK-02: an answer the Brain sends is within the limit, and a refusal always
carries a reason. -/
theorem answer_body_is_well_formed (accept : Option Bool) (reasonLen : Nat) (b : Bool) (len : Nat)
    (h : parseAnswer accept reasonLen = some (b, len)) :
    len ≤ fieldMax ∧ (b = false → 1 ≤ len) := by
  unfold parseAnswer at h
  cases accept with
  | none => simp at h
  | some v =>
    cases v with
    | true =>
      simp at h
      obtain ⟨rfl, rfl⟩ := h
      simp [fieldMax, Nat.min_le_right]
    | false =>
      by_cases hz : reasonLen = 0
      · simp [hz] at h
      · simp [hz] at h
        obtain ⟨rfl, rfl⟩ := h
        simp [fieldMax, Nat.le_min]
        omega

/-- P-NOUSWORK-03: a write the Grid applied was sent on the version the Brain read, and
moved the card exactly one version on. -/
theorem applied_write_was_on_the_version_read {s s' : Card Did} {base : Nat} {a : Did} {n : Bool}
    {op : Op} (h : write s base a n op = some s') : base = s.version ∧ s'.version = base + 1 := by
  unfold write at h
  split at h
  · rename_i hb
    exact ⟨hb, by rw [step_bumps_version h, hb]⟩
  · cases h

end NousWork

#print axioms NousWork.picked_step_is_allowed
#print axioms NousWork.no_step_outside_the_nous_stages
#print axioms NousWork.verify_body_is_well_formed
#print axioms NousWork.answer_body_is_well_formed
#print axioms NousWork.applied_write_was_on_the_version_read
