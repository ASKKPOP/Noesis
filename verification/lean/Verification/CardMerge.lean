import Verification.VectorClock
import Verification.HybridClock

/-
Model of `KnowledgePool.mergeCard` in `protocol/src/knowledge.ts`: one knowledge
card held by many replicas.

A card here is its CRDT part: `vectorClock`, `hlc`, `tombstone`, and `val`, which
stands for the card's content as the write that produced it. A write is named by
the node that made it and that node's count at the time (`seq`): node `n`'s
third write is `⟨n, 3⟩`. A clock `vc` covers a write `w` when `1 ≤ w.seq ≤ vc w.node`,
which is what "this replica has seen that write" means.

`stampOf w` is the stamp write `w` was made with, and `isDelete w` says whether
it was a delete. Both are fixed for the whole history.

Nothing here is bounded: the theorems hold for any nodes, counts, stamps and clock readings.
-/

namespace CardMerge

open HybridClock
open Classical

abbrev Clock (Node : Type) := VectorClock.Clock Node

structure Write (Node : Type) where
  node : Node
  seq : Nat

structure Card (Node : Type) where
  vectorClock : Clock Node
  hlc : Stamp
  val : Write Node
  tombstone : Bool

variable {Node : Type}

/-- The replica holding clock `vc` has seen write `w`. -/
def covered (w : Write Node) (vc : Clock Node) : Prop := 1 ≤ w.seq ∧ w.seq ≤ vc w.node

/-- `mergeCard(remote)` at a replica that holds `loc`, after the remote card passed validation. -/
noncomputable def mergeCard (loc rem : Card Node) : Card Node :=
  if VectorClock.le rem.vectorClock loc.vectorClock then
    loc -- equal or stale: discard
  else
    { vectorClock := VectorClock.merge loc.vectorClock rem.vectorClock
      hlc := if lt loc.hlc rem.hlc then rem.hlc else loc.hlc
      val :=
        if VectorClock.le loc.vectorClock rem.vectorClock then rem.val -- remote strictly newer
        else if lt loc.hlc rem.hlc then rem.val else loc.val
      tombstone := loc.tombstone || rem.tombstone }

theorem covered_merge (w : Write Node) (a b : Clock Node) :
    covered w (VectorClock.merge a b) ↔ covered w a ∨ covered w b := by
  unfold covered VectorClock.merge
  omega

theorem covered_mono {w : Write Node} {a b : Clock Node} (h : VectorClock.le a b)
    (hw : covered w a) : covered w b :=
  ⟨hw.1, Nat.le_trans hw.2 (h w.node)⟩

theorem mergeCard_stale {loc rem : Card Node}
    (h : VectorClock.le rem.vectorClock loc.vectorClock) : mergeCard loc rem = loc := by
  unfold mergeCard
  rw [if_pos h]

/-- The merged clock is always the node-by-node larger count, also when the remote is discarded. -/
theorem mergeCard_vectorClock (loc rem : Card Node) :
    (mergeCard loc rem).vectorClock = VectorClock.merge loc.vectorClock rem.vectorClock := by
  unfold mergeCard
  split
  · next h =>
    funext n
    exact (Nat.max_eq_left (h n)).symm
  · rfl

/-- P-CARD-03: delivering a card again changes nothing. -/
theorem mergeCard_redeliver (loc rem : Card Node) :
    mergeCard (mergeCard loc rem) rem = mergeCard loc rem := by
  apply mergeCard_stale
  rw [mergeCard_vectorClock]
  exact (VectorClock.merge_upper_bound loc.vectorClock rem.vectorClock).2

/-- P-CARD-03: a card merged with itself is unchanged. -/
theorem mergeCard_idem (c : Card Node) : mergeCard c c = c :=
  mergeCard_stale (fun n => Nat.le_refl (c.vectorClock n))

/-- P-CARD-04: a deleted card stays deleted through any merge. -/
theorem tombstone_sticky (loc rem : Card Node) (h : loc.tombstone = true) :
    (mergeCard loc rem).tombstone = true := by
  unfold mergeCard
  split
  · exact h
  · simp [h]

/-- P-CARD-05: a merge never moves a replica's card backward: not its clock, not its stamp. -/
theorem mergeCard_never_backward (loc rem : Card Node) :
    VectorClock.le loc.vectorClock (mergeCard loc rem).vectorClock
      ∧ ¬ lt (mergeCard loc rem).hlc loc.hlc := by
  refine ⟨?_, ?_⟩
  · rw [mergeCard_vectorClock]
    exact (VectorClock.merge_upper_bound loc.vectorClock rem.vectorClock).1
  · unfold mergeCard
    split
    · exact lt_irrefl _
    · show ¬ lt (if lt loc.hlc rem.hlc then rem.hlc else loc.hlc) loc.hlc
      split
      · next h => exact lt_asymm h
      · exact lt_irrefl _

/-! ## What a replica holds, in terms of the writes it has seen -/

section History

variable (stampOf : Write Node → Stamp) (isDelete : Write Node → Bool)

/-- The card is exactly what the writes it has seen say it should be: it shows the
seen write with the largest stamp, and it is deleted exactly when a delete was seen. -/
structure Good (c : Card Node) : Prop where
  val_seen : covered c.val c.vectorClock
  hlc_eq : c.hlc = stampOf c.val
  hlc_max : ∀ w, covered w c.vectorClock → ¬ lt c.hlc (stampOf w)
  tomb_iff : c.tombstone = true ↔ ∃ w, covered w c.vectorClock ∧ isDelete w = true

variable {stampOf isDelete}

/-- P-CARD-02 and P-CARD-04: after any merge the replica still shows the largest-stamp
write among everything it has now seen, and is deleted exactly when a delete was seen. -/
theorem mergeCard_good {loc rem : Card Node} (hl : Good stampOf isDelete loc)
    (hr : Good stampOf isDelete rem) : Good stampOf isDelete (mergeCard loc rem) := by
  by_cases h1 : VectorClock.le rem.vectorClock loc.vectorClock
  · rw [mergeCard_stale h1]
    exact hl
  · have hvc := mergeCard_vectorClock loc rem
    have hhlc : (mergeCard loc rem).hlc = if lt loc.hlc rem.hlc then rem.hlc else loc.hlc := by
      unfold mergeCard; rw [if_neg h1]
    have hval : (mergeCard loc rem).val =
        if VectorClock.le loc.vectorClock rem.vectorClock then rem.val
        else if lt loc.hlc rem.hlc then rem.val else loc.val := by
      unfold mergeCard; rw [if_neg h1]
    have htomb : (mergeCard loc rem).tombstone = (loc.tombstone || rem.tombstone) := by
      unfold mergeCard; rw [if_neg h1]
    -- the merged stamp is not smaller than either input stamp
    have hge_l : ¬ lt (mergeCard loc rem).hlc loc.hlc := (mergeCard_never_backward loc rem).2
    have hge_r : ¬ lt (mergeCard loc rem).hlc rem.hlc := by
      rw [hhlc]
      split
      · exact lt_irrefl _
      · next h => exact h
    refine ⟨?_, ?_, ?_, ?_⟩
    · -- val_seen
      rw [hvc, hval]
      apply (covered_merge _ _ _).mpr
      split
      · exact Or.inr hr.val_seen
      · split
        · exact Or.inr hr.val_seen
        · exact Or.inl hl.val_seen
    · -- hlc_eq
      rw [hhlc, hval]
      by_cases h2 : VectorClock.le loc.vectorClock rem.vectorClock
      · rw [if_pos h2]
        -- the remote has seen the local write, so the remote stamp is not smaller
        have hle : ¬ lt rem.hlc loc.hlc := by
          have := hr.hlc_max loc.val (covered_mono h2 hl.val_seen)
          rwa [← hl.hlc_eq] at this
        by_cases h3 : lt loc.hlc rem.hlc
        · rw [if_pos h3]; exact hr.hlc_eq
        · rw [if_neg h3, eq_of_not_lt h3 hle]; exact hr.hlc_eq
      · rw [if_neg h2]
        by_cases h3 : lt loc.hlc rem.hlc
        · rw [if_pos h3, if_pos h3]; exact hr.hlc_eq
        · rw [if_neg h3, if_neg h3]; exact hl.hlc_eq
    · -- hlc_max
      intro w hw
      rw [hvc] at hw
      rcases (covered_merge _ _ _).mp hw with hw | hw
      · exact not_lt_trans (hl.hlc_max w hw) hge_l
      · exact not_lt_trans (hr.hlc_max w hw) hge_r
    · -- tomb_iff
      rw [htomb, hvc, Bool.or_eq_true, hl.tomb_iff, hr.tomb_iff]
      constructor
      · rintro (⟨w, hw, hd⟩ | ⟨w, hw, hd⟩)
        · exact ⟨w, (covered_merge _ _ _).mpr (Or.inl hw), hd⟩
        · exact ⟨w, (covered_merge _ _ _).mpr (Or.inr hw), hd⟩
      · rintro ⟨w, hw, hd⟩
        rcases (covered_merge _ _ _).mp hw with hw | hw
        · exact Or.inl ⟨w, hw, hd⟩
        · exact Or.inr ⟨w, hw, hd⟩

/-- P-CARD-01: two replicas that have seen the same writes hold the same card,
provided no two writes share a stamp. -/
theorem converge {a b : Card Node} (huniq : ∀ x y, stampOf x = stampOf y → x = y)
    (ha : Good stampOf isDelete a) (hb : Good stampOf isDelete b)
    (hvc : a.vectorClock = b.vectorClock) : a = b := by
  have h1 : ¬ lt a.hlc b.hlc := by
    have := ha.hlc_max b.val (hvc ▸ hb.val_seen)
    rwa [← hb.hlc_eq] at this
  have h2 : ¬ lt b.hlc a.hlc := by
    have := hb.hlc_max a.val (hvc ▸ ha.val_seen)
    rwa [← ha.hlc_eq] at this
  have hhlc : a.hlc = b.hlc := eq_of_not_lt h1 h2
  have hval : a.val = b.val := huniq _ _ (by rw [← ha.hlc_eq, ← hb.hlc_eq, hhlc])
  have htomb : a.tombstone = b.tombstone := by
    have hiff : a.tombstone = true ↔ b.tombstone = true := by
      rw [ha.tomb_iff, hb.tomb_iff, hvc]
    cases hta : a.tombstone <;> cases htb : b.tombstone <;> simp_all
  cases a; cases b; simp_all

/-- P-CARD-01: the order in which two cards meet does not matter. -/
theorem mergeCard_comm {loc rem : Card Node} (huniq : ∀ x y, stampOf x = stampOf y → x = y)
    (hl : Good stampOf isDelete loc) (hr : Good stampOf isDelete rem) :
    mergeCard loc rem = mergeCard rem loc := by
  apply converge huniq (mergeCard_good hl hr) (mergeCard_good hr hl)
  rw [mergeCard_vectorClock, mergeCard_vectorClock, VectorClock.merge_comm]

/-- P-CARD-01: nor does the grouping when three cards meet. -/
theorem mergeCard_assoc {a b c : Card Node} (huniq : ∀ x y, stampOf x = stampOf y → x = y)
    (ha : Good stampOf isDelete a) (hb : Good stampOf isDelete b) (hc : Good stampOf isDelete c) :
    mergeCard (mergeCard a b) c = mergeCard a (mergeCard b c) := by
  apply converge huniq (mergeCard_good (mergeCard_good ha hb) hc)
    (mergeCard_good ha (mergeCard_good hb hc))
  simp only [mergeCard_vectorClock, VectorClock.merge_assoc]

/-! ## A local write -/

variable [DecidableEq Node]

/-- `updateCard` / `confirmKnowledge` (`del = false`) or `deleteCard` (`del = true`) by
node `n`, whose node id orders as `nodeId`, with `Date.now() = pt`. -/
def write (c : Card Node) (n : Node) (nodeId pt : Nat) (del : Bool) : Card Node :=
  { vectorClock := fun m => if m = n then c.vectorClock n + 1 else c.vectorClock m
    hlc := stampWrite c.hlc pt nodeId
    val := ⟨n, c.vectorClock n + 1⟩
    tombstone := c.tombstone || del }

omit [DecidableEq Node] in
/-- P-HLC-05: a new write's stamp is larger than the stamp of every write its replica had seen. -/
theorem write_above_seen {c : Card Node} (hc : Good stampOf isDelete c) (nodeId pt : Nat)
    (w : Write Node) (hw : covered w c.vectorClock) :
    lt (stampOf w) (stampWrite c.hlc pt nodeId) :=
  stampWrite_gt c.hlc (stampOf w) pt nodeId (hc.hlc_max w hw)

theorem covered_write (c : Card Node) (n : Node) (nodeId pt : Nat) (del : Bool) (w : Write Node) :
    covered w (write c n nodeId pt del).vectorClock ↔
      covered w c.vectorClock ∨ w = ⟨n, c.vectorClock n + 1⟩ := by
  unfold covered write
  simp only
  constructor
  · intro ⟨h1, h2⟩
    by_cases hn : w.node = n
    · rw [if_pos hn] at h2
      by_cases hs : w.seq = c.vectorClock n + 1
      · right
        cases w
        simp_all
      · left
        rw [hn]
        omega
    · rw [if_neg hn] at h2
      exact Or.inl ⟨h1, h2⟩
  · rintro (⟨h1, h2⟩ | h)
    · by_cases hn : w.node = n
      · rw [if_pos hn]
        rw [hn] at h2
        omega
      · rw [if_neg hn]
        exact ⟨h1, h2⟩
    · subst h
      simp

/-- P-CARD-02 and P-CARD-04: a local write keeps the card what its seen writes say it
should be, given the write is stamped as the code stamps it. -/
theorem write_good {c : Card Node} (hc : Good stampOf isDelete c) (n : Node) (nodeId pt : Nat)
    (del : Bool) (hs : stampOf ⟨n, c.vectorClock n + 1⟩ = stampWrite c.hlc pt nodeId)
    (hd : isDelete ⟨n, c.vectorClock n + 1⟩ = del) :
    Good stampOf isDelete (write c n nodeId pt del) := by
  refine ⟨?_, ?_, ?_, ?_⟩
  · exact (covered_write c n nodeId pt del _).mpr (Or.inr rfl)
  · exact hs.symm
  · intro w hw
    show ¬ lt (stampWrite c.hlc pt nodeId) (stampOf w)
    rcases (covered_write c n nodeId pt del w).mp hw with hw | hw
    · exact lt_asymm (write_above_seen hc nodeId pt w hw)
    · rw [hw, hs]
      exact lt_irrefl _
  · show (c.tombstone || del) = true ↔ _
    rw [Bool.or_eq_true, hc.tomb_iff]
    constructor
    · rintro (⟨w, hw, hdw⟩ | h)
      · exact ⟨w, (covered_write c n nodeId pt del w).mpr (Or.inl hw), hdw⟩
      · exact ⟨_, (covered_write c n nodeId pt del _).mpr (Or.inr rfl), hd.trans h⟩
    · rintro ⟨w, hw, hdw⟩
      rcases (covered_write c n nodeId pt del w).mp hw with hw | hw
      · exact Or.inl ⟨w, hw, hdw⟩
      · right
        rw [hw] at hdw
        exact hd.symm.trans hdw

end History

end CardMerge

#print axioms CardMerge.mergeCard_redeliver
#print axioms CardMerge.mergeCard_idem
#print axioms CardMerge.tombstone_sticky
#print axioms CardMerge.mergeCard_never_backward
#print axioms CardMerge.mergeCard_good
#print axioms CardMerge.converge
#print axioms CardMerge.mergeCard_comm
#print axioms CardMerge.mergeCard_assoc
#print axioms CardMerge.write_above_seen
#print axioms CardMerge.write_good
