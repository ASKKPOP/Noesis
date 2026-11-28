/-
Model of whom a Brain trusts to teach it a skill.

  brain/src/noesis_brain/social_logic.py      `hot_ties`, `skill_trust_weight`
  brain/src/noesis_brain/skills/peer_filter.py   gate 1 (`TRUST_THRESHOLD_SKILL`)
  brain/src/noesis_brain/skills/quarantine.py    `sweep`
  grid/src/relationships/canonical.ts         `warmthBucket`

Weights are whole hundredths (35 is 0.35), so no real-number library is needed.
A skill from a peer is held to one weight: the weight the Brain already holds for
that peer, raised to the hot floor when the Grid's latest answer lists the peer as
a hot tie. The skill passes when that weight reaches the threshold — once when it
arrives, and again when its quarantine ends.

Nothing here is bounded. The flood cap, the injection scan and the timing of the
ties read are not modelled here (see `verification/PROPERTIES.md`, stated limits).
-/

namespace SkillTrust

/-- `TRUST_THRESHOLD_SKILL` (0.35). -/
def threshold : Nat := 35
/-- `HOT_TIE_WEIGHT` (0.60): what a hot tie is worth as a weight. -/
def hotWeight : Nat := 60
/-- The Grid's bucket bounds: below 0.20 is cold, below 0.60 is warm, the rest is hot. -/
def coldMax : Nat := 20
def warmMax : Nat := 60

inductive Bucket where
  | cold | warm | hot
  deriving DecidableEq

/-- `warmthBucket` on the Grid. -/
def bucketOf (w : Nat) : Bucket :=
  if w < coldMax then .cold else if w < warmMax then .warm else .hot

/-- `skill_trust_weight`: the held weight, or the hot floor for a hot tie, whichever is higher. -/
def trustWeight (held : Nat) (hot : Bool) : Nat :=
  if hot then max held hotWeight else held

def trusted (held : Nat) (hot : Bool) : Bool := decide (threshold ≤ trustWeight held hot)

/-- What the Brain keeps from a ties read: `none` is a read that failed. A peer is a hot
tie only when the answer came and calls it hot. -/
def hotFromRead : Option Bucket → Bool
  | some .hot => true
  | _ => false

/-- Where a taught skill is. -/
inductive Slot where
  | refused | quarantined | active | evicted
  deriving DecidableEq

/-- Arrival: quarantined when the teacher is trusted, otherwise refused. -/
def arrive (held : Nat) (read : Option Bucket) : Slot :=
  if trusted held (hotFromRead read) then .quarantined else .refused

/-- End of quarantine: trust is checked again, with what the Brain holds then. -/
def sweep (s : Slot) (held : Nat) (read : Option Bucket) : Slot :=
  match s with
  | .quarantined => if trusted held (hotFromRead read) then .active else .evicted
  | other => other

/-! ## The registered properties -/

/-- P-SKILLTRUST-01: a teacher is trusted exactly when the Brain holds a weight of at
least 0.35 for it, or the Grid lists it as a hot tie. -/
theorem trusted_iff (held : Nat) (hot : Bool) :
    trusted held hot = true ↔ threshold ≤ held ∨ hot = true := by
  cases hot <;> simp [trusted, trustWeight, threshold, hotWeight] <;> omega

/-- P-SKILLTRUST-01: with no held weight, a warm, cold or unlisted peer is not trusted. -/
theorem only_hot_without_weight (read : Option Bucket) (h : trusted 0 (hotFromRead read) = true) :
    read = some .hot := by
  match read with
  | some .hot => rfl
  | some .warm => simp [trusted, trustWeight, hotFromRead, threshold] at h
  | some .cold => simp [trusted, trustWeight, hotFromRead, threshold] at h
  | none => simp [trusted, trustWeight, hotFromRead, threshold] at h

/-- Why hot and not warm: every weight the Grid calls hot reaches the skill threshold … -/
theorem hot_bucket_reaches_threshold (w : Nat) (h : bucketOf w = .hot) : threshold ≤ w := by
  unfold bucketOf at h
  split at h
  · cases h
  · split at h
    · cases h
    · simp [warmMax, threshold] at *
      omega

/-- … and a weight the Grid calls warm can be below it. -/
theorem warm_bucket_can_miss_threshold : ∃ w, bucketOf w = .warm ∧ w < threshold :=
  ⟨20, by decide, by decide⟩

/-- P-SKILLTRUST-02: a ties read that failed trusts nobody the Brain holds no weight for. -/
theorem failed_read_trusts_nobody (held : Nat) (h : held < threshold) :
    trusted held (hotFromRead none) = false := by
  simp [trusted, trustWeight, hotFromRead, threshold] at *
  omega

/-- P-SKILLTRUST-03: a skill is quarantined only if its teacher was trusted on arrival. -/
theorem quarantined_only_if_trusted {held : Nat} {read : Option Bucket}
    (h : arrive held read = .quarantined) : trusted held (hotFromRead read) = true := by
  unfold arrive at h
  split at h
  · assumption
  · cases h

/-- P-SKILLTRUST-03: a skill joins the skills only if its teacher was trusted on arrival
and again at the end of quarantine. -/
theorem active_only_if_trusted_twice {held₁ held₂ : Nat} {read₁ read₂ : Option Bucket}
    (h : sweep (arrive held₁ read₁) held₂ read₂ = .active) :
    trusted held₁ (hotFromRead read₁) = true ∧ trusted held₂ (hotFromRead read₂) = true := by
  unfold arrive at h
  split at h
  · rename_i h1
    refine ⟨h1, ?_⟩
    simp only [sweep] at h
    split at h
    · assumption
    · cases h
  · simp [sweep] at h

end SkillTrust

#print axioms SkillTrust.trusted_iff
#print axioms SkillTrust.only_hot_without_weight
#print axioms SkillTrust.hot_bucket_reaches_threshold
#print axioms SkillTrust.warm_bucket_can_miss_threshold
#print axioms SkillTrust.failed_read_trusts_nobody
#print axioms SkillTrust.quarantined_only_if_trusted
#print axioms SkillTrust.active_only_if_trusted_twice
