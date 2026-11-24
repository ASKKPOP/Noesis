---------------------------- MODULE VectorClock ----------------------------
(***************************************************************************)
(* Model of the vector clocks in protocol/src/knowledge.ts.                *)
(*                                                                         *)
(*   Tick(r)       models  vectorClock[did] = (vectorClock[did] || 0) + 1  *)
(*   Receive(r, s) models  mergeVectorClocks(local, remote)                *)
(*                                                                         *)
(*   Deliver(r, m) models  mergeCard(remote) for a card from the network   *)
(*                         whose clock is not a valid clock                *)
(*                                                                         *)
(* A missing entry in the code reads as 0; here every entry is present and *)
(* starts at 0. Bad stands for any count that is not a whole number >= 0   *)
(* (negative, fractional, NaN, a string). A merge that reads Bad gives     *)
(* Bad, as Math.max does with NaN.                                         *)
(***************************************************************************)
EXTENDS Integers

CONSTANTS Replicas, MaxTick

VARIABLE clock      \* clock[r][n] = what replica r knows of replica n's count

Max(a, b) == IF a >= b THEN a ELSE b

Merge(a, b) == [n \in Replicas |-> Max(a[n], b[n])]

Leq(a, b) == \A n \in Replicas : a[n] <= b[n]

Bad == -1

Valid(m) == \A n \in Replicas : m[n] \in Nat

\* Every clock a peer can send that has at least one bad count.
InvalidClocks == {m \in [Replicas -> (0..MaxTick) \cup {Bad}] : ~Valid(m)}

\* What an unguarded merge would store.
RawMerge(a, m) == [n \in Replicas |-> IF m[n] = Bad THEN Bad ELSE Max(a[n], m[n])]

Init == clock = [r \in Replicas |-> [n \in Replicas |-> 0]]

Tick(r) ==
    /\ clock[r][r] < MaxTick
    /\ clock' = [clock EXCEPT ![r][r] = @ + 1]

Receive(r, s) ==
    /\ r # s
    /\ clock' = [clock EXCEPT ![r] = Merge(clock[r], clock[s])]

Deliver(r, m) ==
    clock' = IF Valid(m) THEN [clock EXCEPT ![r] = RawMerge(clock[r], m)] ELSE clock

Next ==
    \E r \in Replicas :
        \/ Tick(r)
        \/ \E s \in Replicas : Receive(r, s)
        \/ \E m \in InvalidClocks : Deliver(r, m)

Spec == Init /\ [][Next]_clock

----------------------------------------------------------------------------

TypeOK == clock \in [Replicas -> [Replicas -> 0..MaxTick]]

\* P-VCLOCK-01: merging two clocks gives the same result in either order.
MergeCommutative ==
    \A r, s \in Replicas : Merge(clock[r], clock[s]) = Merge(clock[s], clock[r])

\* P-VCLOCK-02: merging three clocks gives the same result however they are grouped.
MergeAssociative ==
    \A r, s, t \in Replicas :
        Merge(Merge(clock[r], clock[s]), clock[t]) = Merge(clock[r], Merge(clock[s], clock[t]))

\* P-VCLOCK-03: merging a clock with itself changes nothing.
MergeIdempotent == \A r \in Replicas : Merge(clock[r], clock[r]) = clock[r]

\* P-VCLOCK-04: a merge is at least as large as both inputs.
MergeUpperBound ==
    \A r, s \in Replicas :
        /\ Leq(clock[r], Merge(clock[r], clock[s]))
        /\ Leq(clock[s], Merge(clock[r], clock[s]))

\* P-VCLOCK-05: no replica knows a higher count for replica r than r itself holds.
NoFutureKnowledge == \A r, s \in Replicas : clock[s][r] <= clock[r][r]

\* P-VCLOCK-06: a replica's clock never goes backward.
NeverBackward == [][\A r \in Replicas : Leq(clock[r], clock'[r])]_clock

\* P-VCLOCK-07: every stored count is a whole number >= 0.
AllCountsNatural == \A r \in Replicas : Valid(clock[r])

\* P-VCLOCK-08: a card whose clock is not valid changes nothing.
InvalidChangesNothing ==
    [][\A r \in Replicas : \A m \in InvalidClocks : Deliver(r, m) => clock' = clock]_clock

=============================================================================
