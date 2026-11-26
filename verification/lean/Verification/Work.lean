/-
Model of one Work and its Work Card going round the nine-stage loop.

  grid/src/work/work-logic.ts     `createWork`, `applyWorkOp`
  grid/src/work/work-service.ts   `WorkService.write` (the version check, the audit record)

`create` and `step` follow `createWork` and `applyWorkOp` branch by branch, with the same
field names. `a` is the Civic-DID of the member who writes; that it is a current member
is checked before either is called. Text is left out: a definition is its number of
checks, a plan its number of steps. The length limits on text are checked by the
property tests only.

Card fields here and in `WorkCard`: `checks` is `checks.length`, `planLen` is `plan.length`,
`approved` is `plan_approved`, `stepsDone` is the number of plan steps with `done`,
`results` holds `some true` / `some false` / `none` for passed / failed / not recorded,
`verifier` is `verified.by`, `hasResult` is `result !== null`, `hasNotice` is `notice !== null`.

Nothing here is bounded: the theorems hold for any DIDs and any sequence of writes.
-/

namespace Work

inductive Stage where
  | goal | define | plan | build | test | verify | deploy | notice | done | declined
  deriving DecidableEq, Repr

/-- How far round the loop a stage is. A declined Work never got past its goal. -/
def Stage.rank : Stage → Nat
  | .goal => 0 | .declined => 0 | .define => 1 | .plan => 2 | .build => 3 | .test => 4
  | .verify => 5 | .deploy => 6 | .notice => 7 | .done => 8

/-- The only moves a stage may make (`STAGE_EDGES`). -/
def edge : Stage → Stage → Bool
  | .goal, .define => true
  | .goal, .declined => true
  | .define, .plan => true
  | .plan, .build => true
  | .build, .test => true
  | .test, .verify => true
  | .verify, .deploy => true
  | .verify, .test => true
  | .deploy, .notice => true
  | .notice, .done => true
  | _, _ => false

structure Card (Did : Type) where
  stage : Stage
  version : Nat
  owner : Did
  builder : Did
  builderIsNous : Bool
  /-- How many checks the definition lists. -/
  checks : Nat
  planLen : Nat
  approved : Bool
  stepsDone : Nat
  /-- One slot per check: not recorded, passed, or failed. -/
  results : List (Option Bool)
  verifier : Option Did
  /-- Whether the member who confirmed was a Nous. -/
  verifierIsNous : Bool
  hasResult : Bool
  hasNotice : Bool

inductive Op where
  | answer (accept : Bool)
  | define (checks : Nat)
  | setPlan (steps : Nat)
  | approvePlan
  | completeStep (step : Nat)
  | recordCheck (check : Nat) (passed : Bool)
  | verify (confirm : Bool)
  | deploy
  | announce

def allPassed (rs : List (Option Bool)) : Bool := rs.all (fun r => r == some true)

variable {Did : Type} [DecidableEq Did]

/-- `createWork`: `a` states a goal and names the builder `b`. The builder must be a
Nous: `a` itself, or another member who is then asked. -/
def create (a : Did) (aIsNous : Bool) (b : Did) (bIsNous : Bool) : Option (Card Did) :=
  if (if b = a then aIsNous else bIsNous) then
    some { stage := if b = a then .define else .goal, version := 1, owner := a, builder := b,
           builderIsNous := true, checks := 0, planLen := 0, approved := false, stepsDone := 0,
           results := [], verifier := none, verifierIsNous := false, hasResult := false, hasNotice := false }
  else none

/-- `applyWorkOp`: one write by member `a`, a Nous or a person (`aIsNous`). `none` is a
refusal. -/
def step (c : Card Did) (a : Did) (aIsNous : Bool) : Op → Option (Card Did)
  | .answer accept =>
    if c.stage = .goal ∧ a = c.builder then
      some { c with stage := if accept then .define else .declined, version := c.version + 1 }
    else none
  | .define checks =>
    if c.stage = .define ∧ (a = c.owner ∨ a = c.builder) ∧ 0 < checks then
      some { c with stage := .plan, version := c.version + 1, checks := checks,
                    results := List.replicate checks none }
    else none
  | .setPlan steps =>
    if c.stage = .plan ∧ (a = c.owner ∨ a = c.builder) ∧ 0 < steps then
      some { c with version := c.version + 1, planLen := steps, approved := false }
    else none
  | .approvePlan =>
    if c.stage = .plan ∧ a = c.owner ∧ 0 < c.planLen then
      some { c with stage := .build, version := c.version + 1, approved := true }
    else none
  | .completeStep k =>
    if c.stage = .build ∧ a = c.builder ∧ k = c.stepsDone + 1 then
      some { c with stage := if c.stepsDone + 1 = c.planLen then .test else .build,
                    version := c.version + 1, stepsDone := c.stepsDone + 1 }
    else none
  | .recordCheck i passed =>
    if c.stage = .test ∧ a = c.builder ∧ i < c.results.length then
      some { c with stage := if allPassed (c.results.set i (some passed)) then .verify else .test,
                    version := c.version + 1, results := c.results.set i (some passed) }
    else none
  | .verify confirm =>
    if c.stage = .verify ∧ a ≠ c.builder ∧ aIsNous = true then
      if confirm then
        some { c with stage := .deploy, version := c.version + 1, verifier := some a,
                      verifierIsNous := aIsNous }
      else
        some { c with stage := .test, version := c.version + 1,
                      results := List.replicate c.checks none }
    else none
  | .deploy =>
    if c.stage = .deploy ∧ a = c.builder then
      some { c with stage := .notice, version := c.version + 1, hasResult := true }
    else none
  | .announce =>
    if c.stage = .notice ∧ a = c.builder then
      some { c with stage := .done, version := c.version + 1, hasNotice := true }
    else none

/-- Who may send which operation, and in which stage (the role table of `applyWorkOp`). -/
def allowed (c : Card Did) (a : Did) (aIsNous : Bool) : Op → Prop
  | .answer _ => c.stage = .goal ∧ a = c.builder
  | .define _ => c.stage = .define ∧ (a = c.owner ∨ a = c.builder)
  | .setPlan _ => c.stage = .plan ∧ (a = c.owner ∨ a = c.builder)
  | .approvePlan => c.stage = .plan ∧ a = c.owner
  | .completeStep _ => c.stage = .build ∧ a = c.builder
  | .recordCheck _ _ => c.stage = .test ∧ a = c.builder
  | .verify _ => c.stage = .verify ∧ a ≠ c.builder ∧ aIsNous = true
  | .deploy => c.stage = .deploy ∧ a = c.builder
  | .announce => c.stage = .notice ∧ a = c.builder

/-- `WorkService.write`: a write is applied only on the version its author read. -/
def write (stored : Card Did) (base : Nat) (a : Did) (aIsNous : Bool) (op : Op) : Option (Card Did) :=
  if base = stored.version then step stored a aIsNous op else none

/-- The `work.stage_changed` record of a write: written only when the stage moved. -/
def auditOf (before after : Card Did) : Option (Stage × Stage) :=
  if before.stage = after.stage then none else some (before.stage, after.stage)

/-- What holds of every card a sequence of writes can produce. -/
structure Inv (c : Card Did) : Prop where
  nous : c.builderIsNous = true
  len : c.results.length = c.checks
  defined : 2 ≤ c.stage.rank → 0 < c.checks
  early : c.stage.rank < 3 → c.stepsDone = 0
  built : 3 ≤ c.stage.rank → 0 < c.checks ∧ c.approved = true ∧ 0 < c.planLen
  building : c.stage = .build → c.stepsDone < c.planLen
  tested : 4 ≤ c.stage.rank → c.stepsDone = c.planLen
  passed : 5 ≤ c.stage.rank → allPassed c.results = true
  notSelf : ∀ v, c.verifier = some v → v ≠ c.builder
  byNous : c.verifier.isSome = true → c.verifierIsNous = true
  confirmed : 6 ≤ c.stage.rank → c.verifier.isSome = true
  result : 7 ≤ c.stage.rank → c.hasResult = true
  notice : 8 ≤ c.stage.rank → c.hasNotice = true

/-- A card that `create` made and writes then changed. -/
inductive Reachable : Card Did → Prop where
  | created {a b : Did} {aIsNous bIsNous : Bool} {c : Card Did} :
      create a aIsNous b bIsNous = some c → Reachable c
  | wrote {c c' : Card Did} {a : Did} {aIsNous : Bool} {op : Op} :
      Reachable c → step c a aIsNous op = some c' → Reachable c'

theorem inv_create {a b : Did} {aIsNous bIsNous : Bool} {c : Card Did}
    (h : create a aIsNous b bIsNous = some c) : Inv c := by
  by_cases hb : b = a
  · simp [create, hb] at h
    obtain ⟨_, rfl⟩ := h
    constructor <;> simp [Stage.rank, allPassed]
  · simp [create, hb] at h
    obtain ⟨_, rfl⟩ := h
    constructor <;> simp [Stage.rank, allPassed]

theorem inv_step {c c' : Card Did} {a : Did} {aIsNous : Bool} {op : Op} (h : Inv c)
    (hs : step c a aIsNous op = some c') : Inv c' := by
  obtain ⟨hn, hl, hdf, he, hb, hbd, ht, hp, hv, hvn, hc, hr, hno⟩ := h
  cases op with
  | answer accept =>
    simp only [step] at hs
    split at hs
    · rename_i hg
      cases hs
      cases accept <;> constructor <;> simp_all [Stage.rank]
    · cases hs
  | define checks =>
    simp only [step] at hs
    split at hs
    · rename_i hg
      cases hs
      constructor <;> simp_all [Stage.rank]
    · cases hs
  | setPlan steps =>
    simp only [step] at hs
    split at hs
    · rename_i hg
      cases hs
      constructor <;> simp_all [Stage.rank]
    · cases hs
  | approvePlan =>
    simp only [step] at hs
    split at hs
    · rename_i hg
      cases hs
      have h0 : c.stepsDone = 0 := he (by simp [hg.1, Stage.rank])
      have hd0 := hdf (by simp [hg.1, Stage.rank])
      constructor <;> simp_all [Stage.rank]
    · cases hs
  | completeStep k =>
    simp only [step] at hs
    split at hs
    · rename_i hg
      cases hs
      have hlt : c.stepsDone < c.planLen := hbd hg.1
      have hb' := hb (by simp [hg.1, Stage.rank])
      by_cases hd : c.stepsDone + 1 = c.planLen
      · constructor <;> simp_all [Stage.rank]
      · constructor <;> simp_all [Stage.rank] <;> omega
    · cases hs
  | recordCheck i passed =>
    simp only [step] at hs
    split at hs
    · rename_i hg
      cases hs
      have hb' := hb (by simp [hg.1, Stage.rank])
      have ht' := ht (by simp [hg.1, Stage.rank])
      by_cases hd : allPassed (c.results.set i (some passed)) = true
      · constructor <;> simp_all [Stage.rank]
      · constructor <;> simp_all [Stage.rank]
    · cases hs
  | verify confirm =>
    simp only [step] at hs
    split at hs
    · rename_i hg
      have hb' := hb (by simp [hg.1, Stage.rank])
      have ht' := ht (by simp [hg.1, Stage.rank])
      have hp' := hp (by simp [hg.1, Stage.rank])
      cases confirm
      · simp only [Bool.false_eq_true, if_false] at hs
        cases hs
        constructor <;> simp_all [Stage.rank]
      · simp only [if_true] at hs
        cases hs
        constructor <;> simp_all [Stage.rank]
    · cases hs
  | deploy =>
    simp only [step] at hs
    split at hs
    · rename_i hg
      cases hs
      have hb' := hb (by simp [hg.1, Stage.rank])
      have ht' := ht (by simp [hg.1, Stage.rank])
      have hp' := hp (by simp [hg.1, Stage.rank])
      have hc' := hc (by simp [hg.1, Stage.rank])
      constructor <;> simp_all [Stage.rank]
    · cases hs
  | announce =>
    simp only [step] at hs
    split at hs
    · rename_i hg
      cases hs
      have hb' := hb (by simp [hg.1, Stage.rank])
      have ht' := ht (by simp [hg.1, Stage.rank])
      have hp' := hp (by simp [hg.1, Stage.rank])
      have hc' := hc (by simp [hg.1, Stage.rank])
      have hr' := hr (by simp [hg.1, Stage.rank])
      constructor <;> simp_all [Stage.rank]
    · cases hs

theorem reachable_inv {c : Card Did} (h : Reachable c) : Inv c := by
  induction h with
  | created hc => exact inv_create hc
  | wrote _ hs ih => exact inv_step ih hs

/-- P-WORK-01: a write moves the stage along an allowed edge or leaves it where it is. -/
theorem step_follows_edge {c c' : Card Did} {a : Did} {aIsNous : Bool} {op : Op}
    (hs : step c a aIsNous op = some c') : edge c.stage c'.stage = true ∨ c'.stage = c.stage := by
  cases op with
  | answer accept =>
    simp only [step] at hs
    split at hs
    · rename_i hg; cases hs; cases accept <;> simp [hg.1, edge]
    · cases hs
  | define checks =>
    simp only [step] at hs
    split at hs
    · rename_i hg; cases hs; simp [hg.1, edge]
    · cases hs
  | setPlan steps =>
    simp only [step] at hs
    split at hs
    · cases hs; simp
    · cases hs
  | approvePlan =>
    simp only [step] at hs
    split at hs
    · rename_i hg; cases hs; simp [hg.1, edge]
    · cases hs
  | completeStep k =>
    simp only [step] at hs
    split at hs
    · rename_i hg; cases hs
      by_cases hd : c.stepsDone + 1 = c.planLen <;> simp [hg.1, hd, edge]
    · cases hs
  | recordCheck i passed =>
    simp only [step] at hs
    split at hs
    · rename_i hg; cases hs
      by_cases hd : allPassed (c.results.set i (some passed)) = true <;> simp [hg.1, hd, edge]
    · cases hs
  | verify confirm =>
    simp only [step] at hs
    split at hs
    · rename_i hg
      cases confirm
      · simp only [Bool.false_eq_true, if_false] at hs; cases hs; simp [hg.1, edge]
      · simp only [if_true] at hs; cases hs; simp [hg.1, edge]
    · cases hs
  | deploy =>
    simp only [step] at hs
    split at hs
    · rename_i hg; cases hs; simp [hg.1, edge]
    · cases hs
  | announce =>
    simp only [step] at hs
    split at hs
    · rename_i hg; cases hs; simp [hg.1, edge]
    · cases hs

/-- P-WORK-06: a write is applied only from the role, and in the stage, its operation
allows. -/
theorem step_only_by_role {c c' : Card Did} {a : Did} {aIsNous : Bool} {op : Op}
    (hs : step c a aIsNous op = some c') : allowed c a aIsNous op := by
  cases op <;> simp only [step] at hs <;> split at hs <;>
    first
      | (rename_i hg; simp only [allowed]; first | exact hg | exact ⟨hg.1, hg.2.1⟩)
      | cases hs

/-- P-WORK-01: a Work that is done or declined takes no further write. -/
theorem terminal_refuses (c : Card Did) (a : Did) (aIsNous : Bool) (op : Op)
    (h : c.stage = .done ∨ c.stage = .declined) : step c a aIsNous op = none := by
  cases hstep : step c a aIsNous op with
  | none => rfl
  | some c' =>
    have hr := step_only_by_role hstep
    cases op <;> simp only [allowed] at hr <;> rcases h with h | h <;> simp [h] at hr

/-- P-WORK-02: a Work that is being built, or is past building, has its checks written
and an approved plan with at least one step. -/
theorem build_needs_checks_and_plan {c : Card Did} (h : Reachable c) (hs : 3 ≤ c.stage.rank) :
    0 < c.checks ∧ c.approved = true ∧ 0 < c.planLen :=
  (reachable_inv h).built hs

/-- P-WORK-03: a Work that is being verified, or is past it, has every step done and
every check passed. -/
theorem verify_needs_all_passed {c : Card Did} (h : Reachable c) (hs : 5 ≤ c.stage.rank) :
    c.stepsDone = c.planLen ∧ allPassed c.results = true ∧ c.results.length = c.checks :=
  ⟨(reachable_inv h).tested (by omega), (reachable_inv h).passed hs, (reachable_inv h).len⟩

/-- P-WORK-04: the verifier is never the builder and is a Nous, and a deployed Work has
one. -/
theorem verifier_is_not_builder {c : Card Did} (h : Reachable c) :
    (∀ v, c.verifier = some v → v ≠ c.builder) ∧ (c.verifier.isSome = true → c.verifierIsNous = true)
      ∧ (6 ≤ c.stage.rank → c.verifier.isSome = true) :=
  ⟨(reachable_inv h).notSelf, (reachable_inv h).byNous, (reachable_inv h).confirmed⟩

/-- P-WORK-05: the builder of a Work is a Nous. -/
theorem builder_is_nous {c : Card Did} (h : Reachable c) : c.builderIsNous = true :=
  (reachable_inv h).nous

/-- P-WORK-05: a person cannot make themself the builder, and cannot name a person. -/
theorem person_never_builds (a b : Did) (aIsNous : Bool) :
    create a false a aIsNous = (none : Option (Card Did))
      ∧ (b ≠ a → create a aIsNous b false = (none : Option (Card Did))) := by
  constructor
  · simp [create]
  · intro hb; simp [create, hb]

/-- P-WORK-07: an audit record is written exactly when the stage moved, and it names an
allowed edge. -/
theorem audit_iff_stage_moved {c c' : Card Did} {a : Did} {aIsNous : Bool} {op : Op}
    (hs : step c a aIsNous op = some c') :
    (auditOf c c' = none ↔ c'.stage = c.stage)
      ∧ (∀ s t, auditOf c c' = some (s, t) → s = c.stage ∧ t = c'.stage ∧ edge s t = true) := by
  constructor
  · unfold auditOf
    by_cases he : c.stage = c'.stage
    · simp [he]
    · simp [he]; exact fun h => he h.symm
  · intro s t h
    unfold auditOf at h
    by_cases he : c.stage = c'.stage
    · simp [he] at h
    · simp [he] at h
      obtain ⟨h1, h2⟩ := h
      subst h1 h2
      rcases step_follows_edge hs with h | h
      · exact ⟨rfl, rfl, h⟩
      · exact absurd h.symm he

/-- P-WORK-08: an applied write raises the version by exactly one. -/
theorem step_bumps_version {c c' : Card Did} {a : Did} {aIsNous : Bool} {op : Op}
    (hs : step c a aIsNous op = some c') : c'.version = c.version + 1 := by
  cases op with
  | verify confirm =>
    simp only [step] at hs
    split at hs
    · cases confirm
      · simp only [Bool.false_eq_true, if_false] at hs; cases hs; rfl
      · simp only [if_true] at hs; cases hs; rfl
    · cases hs
  | _ =>
    simp only [step] at hs
    split at hs
    · cases hs; rfl
    · cases hs

/-- P-WORK-08: of two writes based on the same version, the second is refused once the
first is applied. -/
theorem second_write_on_same_base_refused {s s' : Card Did} {base : Nat} {a a' : Did} {n n' : Bool}
    {op op' : Op} (h : write s base a n op = some s') :
    write s' base a' n' op' = (none : Option (Card Did)) := by
  unfold write at h
  split at h
  · rename_i hb
    have hv := step_bumps_version h
    unfold write
    have : base ≠ s'.version := by omega
    simp [this]
  · cases h

/-- P-WORK-06: a refused write leaves the stored card as it was — `write` gives back no
card to store. A write on a stale version is always refused. -/
theorem stale_write_refused (s : Card Did) (base : Nat) (a : Did) (aIsNous : Bool) (op : Op)
    (h : base ≠ s.version) : write s base a aIsNous op = none := by
  simp [write, h]

/-- P-WORK-09: a Work whose notice is due has its result record, and a done Work has its
notice too. -/
theorem done_is_complete {c : Card Did} (h : Reachable c) :
    (7 ≤ c.stage.rank → c.hasResult = true) ∧ (c.stage = .done → c.hasNotice = true) :=
  ⟨(reachable_inv h).result, fun hd => (reachable_inv h).notice (by simp [hd, Stage.rank])⟩

end Work

#print axioms Work.step_follows_edge
#print axioms Work.terminal_refuses
#print axioms Work.build_needs_checks_and_plan
#print axioms Work.verify_needs_all_passed
#print axioms Work.verifier_is_not_builder
#print axioms Work.builder_is_nous
#print axioms Work.person_never_builds
#print axioms Work.step_only_by_role
#print axioms Work.stale_write_refused
#print axioms Work.audit_iff_stage_moved
#print axioms Work.step_bumps_version
#print axioms Work.second_write_on_same_base_refused
#print axioms Work.done_is_complete
