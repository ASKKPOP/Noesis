/-
Model of the trusted-peer list in `brain/src/noesis_brain/social_logic.py`
(`trusted_peers`) and of the check the social cycle makes before it queues a
message (`_run_social_cycle` in `brain/src/noesis_brain/rpc/handler.py`).

The code walks its candidates in priority order — peers with a known weight of
at least 0.3, then hot ties, then warm ties — and keeps a candidate when it is
not the mind itself, is not already kept, and fewer than three are kept. `step`
is that loop body; `pickFrom` is the loop.

Cold ties, unknown DIDs and malformed entries are in none of the three lists:
the code drops them before the loop. The property tests check that filtering.

Nothing here is bounded: the theorems hold for any DIDs and lists of any length.
-/

namespace SocialPeers

variable {Did : Type} [DecidableEq Did]

/-- `MAX_PEERS`. -/
def maxPeers : Nat := 3

/-- The loop body: keep `d` unless it is the mind itself, already kept, or the list is full. -/
def step (self : Did) (acc : List Did) (d : Did) : List Did :=
  if d = self ∨ d ∈ acc ∨ maxPeers ≤ acc.length then acc else acc ++ [d]

/-- The loop, started from `acc`. -/
def pickFrom (self : Did) (acc cands : List Did) : List Did :=
  cands.foldl (step self) acc

/-- `trusted_peers`: weighted peers first, then hot ties, then warm ties. -/
def trustedPeers (self : Did) (weighted hot warm : List Did) : List Did :=
  pickFrom self [] (weighted ++ hot ++ warm)

/-- What the cycle queues when the model names `answer`: a message to it, or nothing. -/
def queued (list : List Did) (answer : Did) : Option Did :=
  if answer ∈ list then some answer else none

/-! ## The loop -/

theorem pickFrom_nil (self : Did) (acc : List Did) : pickFrom self acc [] = acc := rfl

theorem pickFrom_cons (self : Did) (acc : List Did) (d : Did) (cs : List Did) :
    pickFrom self acc (d :: cs) = pickFrom self (step self acc d) cs := rfl

theorem pickFrom_append (self : Did) (acc a b : List Did) :
    pickFrom self acc (a ++ b) = pickFrom self (pickFrom self acc a) b := by
  simp [pickFrom, List.foldl_append]

theorem step_mem {self : Did} {acc : List Did} {d x : Did} (h : x ∈ step self acc d) :
    x ∈ acc ∨ (x ≠ self ∧ x = d) := by
  unfold step at h
  split at h
  · exact Or.inl h
  · rename_i hn
    rcases List.mem_append.mp h with h | h
    · exact Or.inl h
    · have hx : x = d := by simpa using h
      refine Or.inr ⟨?_, hx⟩
      intro hs
      exact hn (Or.inl (hx ▸ hs))

theorem step_keeps {self : Did} {acc : List Did} {d x : Did} (h : x ∈ acc) :
    x ∈ step self acc d := by
  unfold step
  split
  · exact h
  · exact List.mem_append.mpr (Or.inl h)

theorem step_length_le {self : Did} {acc : List Did} {d : Did} (h : acc.length ≤ maxPeers) :
    (step self acc d).length ≤ maxPeers := by
  unfold step
  split
  · exact h
  · rename_i hn
    have : ¬ maxPeers ≤ acc.length := fun hf => hn (Or.inr (Or.inr hf))
    simp only [List.length_append, List.length_singleton]
    omega

theorem step_length_ge {self : Did} {acc : List Did} {d : Did} :
    acc.length ≤ (step self acc d).length := by
  unfold step
  split
  · exact Nat.le_refl _
  · simp only [List.length_append, List.length_singleton]
    omega

theorem step_nodup {self : Did} {acc : List Did} {d : Did} (h : acc.Nodup) :
    (step self acc d).Nodup := by
  unfold step
  split
  · exact h
  · rename_i hn
    have hd : d ∉ acc := fun hf => hn (Or.inr (Or.inl hf))
    unfold List.Nodup at h ⊢
    rw [List.pairwise_append]
    refine ⟨h, List.pairwise_singleton _ _, ?_⟩
    intro a ha b hb
    have hbd : b = d := by simpa using hb
    intro hab
    exact hd (hbd ▸ hab ▸ ha)

/-- A kept candidate, or a full list: nothing eligible is skipped while there is room. -/
theorem step_kept_or_full {self : Did} {acc : List Did} {d : Did} (hd : d ≠ self) :
    d ∈ step self acc d ∨ maxPeers ≤ (step self acc d).length := by
  unfold step
  split
  · rename_i hc
    rcases hc with hc | hc | hc
    · exact absurd hc hd
    · exact Or.inl hc
    · exact Or.inr hc
  · exact Or.inl (List.mem_append.mpr (Or.inr (List.mem_singleton.mpr rfl)))

theorem step_full {self : Did} {acc : List Did} {d : Did} (h : maxPeers ≤ acc.length) :
    step self acc d = acc := by
  unfold step
  simp [h]

theorem pickFrom_mem {self : Did} {cs : List Did} :
    ∀ {acc : List Did} {x : Did}, x ∈ pickFrom self acc cs → x ∈ acc ∨ (x ≠ self ∧ x ∈ cs) := by
  induction cs with
  | nil => intro acc x h; exact Or.inl h
  | cons d cs ih =>
    intro acc x h
    rw [pickFrom_cons] at h
    rcases ih h with h | ⟨hs, hc⟩
    · rcases step_mem h with h | ⟨hs, hx⟩
      · exact Or.inl h
      · exact Or.inr ⟨hs, hx ▸ List.mem_cons_self _ _⟩
    · exact Or.inr ⟨hs, List.mem_cons_of_mem _ hc⟩

theorem pickFrom_keeps {self : Did} {cs : List Did} :
    ∀ {acc : List Did} {x : Did}, x ∈ acc → x ∈ pickFrom self acc cs := by
  induction cs with
  | nil => intro acc x h; exact h
  | cons d cs ih => intro acc x h; rw [pickFrom_cons]; exact ih (step_keeps h)

theorem pickFrom_length_le {self : Did} {cs : List Did} :
    ∀ {acc : List Did}, acc.length ≤ maxPeers → (pickFrom self acc cs).length ≤ maxPeers := by
  induction cs with
  | nil => intro acc h; exact h
  | cons d cs ih => intro acc h; rw [pickFrom_cons]; exact ih (step_length_le h)

theorem pickFrom_length_ge {self : Did} {cs : List Did} :
    ∀ {acc : List Did}, acc.length ≤ (pickFrom self acc cs).length := by
  induction cs with
  | nil => intro acc; exact Nat.le_refl _
  | cons d cs ih => intro acc; rw [pickFrom_cons]; exact Nat.le_trans step_length_ge ih

theorem pickFrom_nodup {self : Did} {cs : List Did} :
    ∀ {acc : List Did}, acc.Nodup → (pickFrom self acc cs).Nodup := by
  induction cs with
  | nil => intro acc h; exact h
  | cons d cs ih => intro acc h; rw [pickFrom_cons]; exact ih (step_nodup h)

theorem pickFrom_full {self : Did} {cs : List Did} :
    ∀ {acc : List Did}, maxPeers ≤ acc.length → pickFrom self acc cs = acc := by
  induction cs with
  | nil => intro acc _; rfl
  | cons d cs ih =>
    intro acc h
    rw [pickFrom_cons, step_full h]
    exact ih h

theorem pickFrom_kept_or_full {self : Did} {cs : List Did} :
    ∀ {acc : List Did} {y : Did}, y ∈ cs → y ≠ self →
      y ∈ pickFrom self acc cs ∨ maxPeers ≤ (pickFrom self acc cs).length := by
  induction cs with
  | nil => intro acc y h; cases h
  | cons d cs ih =>
    intro acc y h hy
    rw [pickFrom_cons]
    rcases List.mem_cons.mp h with h | h
    · subst h
      rcases step_kept_or_full (acc := acc) hy with hk | hf
      · exact Or.inl (pickFrom_keeps hk)
      · exact Or.inr (Nat.le_trans hf pickFrom_length_ge)
    · exact ih h hy

/-- Candidates earlier in the walk come first: a later one is kept only if every earlier one is. -/
theorem earlier_first {self : Did} {a b : List Did} {x y : Did}
    (hx : x ∈ pickFrom self [] (a ++ b)) (hxa : x ∉ a) (hy : y ∈ a) (hys : y ≠ self) :
    y ∈ pickFrom self [] (a ++ b) := by
  rw [pickFrom_append] at hx ⊢
  rcases pickFrom_kept_or_full (acc := []) hy hys with hk | hf
  · exact pickFrom_keeps hk
  · rw [pickFrom_full hf] at hx
    rcases pickFrom_mem hx with h | ⟨_, h⟩
    · cases h
    · exact absurd h hxa

/-! ## The properties -/

/-- P-SOCIAL-01: a trusted peer is never the mind itself and always comes from one of the
three trusted sources — never a cold or unknown DID. -/
theorem trusted_sound {self : Did} {weighted hot warm : List Did} {d : Did}
    (h : d ∈ trustedPeers self weighted hot warm) :
    d ≠ self ∧ (d ∈ weighted ∨ d ∈ hot ∨ d ∈ warm) := by
  rcases pickFrom_mem h with h | ⟨hs, hc⟩
  · cases h
  · refine ⟨hs, ?_⟩
    rcases List.mem_append.mp hc with hc | hc
    · rcases List.mem_append.mp hc with hc | hc
      · exact Or.inl hc
      · exact Or.inr (Or.inl hc)
    · exact Or.inr (Or.inr hc)

/-- P-SOCIAL-02: the list has at most three entries. -/
theorem trusted_length_le (self : Did) (weighted hot warm : List Did) :
    (trustedPeers self weighted hot warm).length ≤ 3 :=
  pickFrom_length_le (Nat.zero_le _)

/-- P-SOCIAL-02: no entry appears twice. -/
theorem trusted_nodup (self : Did) (weighted hot warm : List Did) :
    (trustedPeers self weighted hot warm).Nodup :=
  pickFrom_nodup List.nodup_nil

/-- P-SOCIAL-03: a warm tie is listed only if every weighted peer and every hot tie is listed. -/
theorem warm_only_after_hot {self : Did} {weighted hot warm : List Did} {x y : Did}
    (hx : x ∈ trustedPeers self weighted hot warm) (hxw : x ∉ weighted) (hxh : x ∉ hot)
    (hy : y ∈ weighted ∨ y ∈ hot) (hys : y ≠ self) :
    y ∈ trustedPeers self weighted hot warm := by
  have hxa : x ∉ weighted ++ hot := fun h => (List.mem_append.mp h).elim hxw hxh
  exact earlier_first hx hxa (List.mem_append.mpr hy) hys

/-- P-SOCIAL-03: a hot tie is listed only if every weighted peer is listed. -/
theorem hot_only_after_weighted {self : Did} {weighted hot warm : List Did} {x y : Did}
    (hx : x ∈ trustedPeers self weighted hot warm) (hxw : x ∉ weighted)
    (hy : y ∈ weighted) (hys : y ≠ self) :
    y ∈ trustedPeers self weighted hot warm := by
  unfold trustedPeers at hx ⊢
  rw [List.append_assoc] at hx ⊢
  exact earlier_first hx hxw hy hys

/-- P-SOCIAL-04: whatever DID the model names, what gets queued is addressed to a trusted
peer — never the mind itself, never a DID outside the three trusted sources. -/
theorem queued_is_trusted {self : Did} {weighted hot warm : List Did} {answer d : Did}
    (h : queued (trustedPeers self weighted hot warm) answer = some d) :
    d ≠ self ∧ (d ∈ weighted ∨ d ∈ hot ∨ d ∈ warm) := by
  unfold queued at h
  split at h
  · rename_i hm
    cases h
    exact trusted_sound hm
  · cases h

end SocialPeers

#print axioms SocialPeers.trusted_sound
#print axioms SocialPeers.trusted_length_le
#print axioms SocialPeers.trusted_nodup
#print axioms SocialPeers.warm_only_after_hot
#print axioms SocialPeers.hot_only_after_weighted
#print axioms SocialPeers.queued_is_trusted
