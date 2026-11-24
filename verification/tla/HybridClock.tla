---------------------------- MODULE HybridClock ----------------------------
(***************************************************************************)
(* Model of the hybrid clocks in protocol/src/knowledge.ts.                *)
(*                                                                         *)
(*   Local(r, pt)       models  tickHLC(current)          with Date.now()=pt *)
(*   Receive(r, m, pt)  models  receiveHLC(local, remote) with Date.now()=pt *)
(*                                                                         *)
(* A stamp is (wall, logical, node). The physical clock reading pt is any  *)
(* value in 0..MaxTime at every step, so clocks may disagree between       *)
(* replicas and may go backward. Every stamp ever made stays deliverable,  *)
(* so messages may be delayed, repeated and reordered.                     *)
(*                                                                         *)
(* Each event also carries a vector clock (bookkeeping only, not in the    *)
(* code) so the model can say which event happened before which.           *)
(***************************************************************************)
EXTENDS Integers

CONSTANTS Replicas, MaxTime, MaxEvents

VARIABLES hlc,      \* hlc[r] = replica r's current stamp
          vc,       \* vc[r]  = bookkeeping: which events r has seen
          log,      \* every event so far: [stamp, vc]
          read      \* every physical clock reading so far

vars == <<hlc, vc, log, read>>

Max(a, b) == IF a >= b THEN a ELSE b

\* compareHLC(a, b) < 0
Less(a, b) ==
    \/ a.wall < b.wall
    \/ a.wall = b.wall /\ a.logical < b.logical
    \/ a.wall = b.wall /\ a.logical = b.logical /\ a.node < b.node

\* Smaller by wall time and logical counter alone.
LessWL(a, b) == a.wall < b.wall \/ (a.wall = b.wall /\ a.logical < b.logical)

\* tickHLC
Tick(s, pt) ==
    IF pt > s.wall
        THEN [wall |-> pt, logical |-> 0, node |-> s.node]
        ELSE [wall |-> s.wall, logical |-> s.logical + 1, node |-> s.node]

\* receiveHLC
Recv(l, m, pt) ==
    LET w == Max(Max(l.wall, m.wall), pt) IN
    [wall    |-> w,
     logical |-> IF w = l.wall /\ w = m.wall THEN Max(l.logical, m.logical) + 1
                 ELSE IF w = l.wall THEN l.logical + 1
                 ELSE IF w = m.wall THEN m.logical + 1
                 ELSE 0,
     node    |-> l.node]

VLeq(a, b) == \A n \in Replicas : a[n] <= b[n]

Init ==
    /\ hlc = [r \in Replicas |-> [wall |-> 0, logical |-> 0, node |-> r]]
    /\ vc = [r \in Replicas |-> [n \in Replicas |-> 0]]
    /\ log = {}
    /\ read = {}

Local(r, pt) ==
    /\ vc[r][r] < MaxEvents
    /\ LET s == Tick(hlc[r], pt)
           v == [vc[r] EXCEPT ![r] = @ + 1]
       IN /\ hlc' = [hlc EXCEPT ![r] = s]
          /\ vc' = [vc EXCEPT ![r] = v]
          /\ log' = log \cup {[stamp |-> s, vc |-> v]}
          /\ read' = read \cup {pt}

Receive(r, m, pt) ==
    /\ vc[r][r] < MaxEvents
    /\ m.stamp.node # r
    /\ LET s == Recv(hlc[r], m.stamp, pt)
           v == [n \in Replicas |-> IF n = r THEN vc[r][r] + 1 ELSE Max(vc[r][n], m.vc[n])]
       IN /\ hlc' = [hlc EXCEPT ![r] = s]
          /\ vc' = [vc EXCEPT ![r] = v]
          /\ log' = log \cup {[stamp |-> s, vc |-> v]}
          /\ read' = read \cup {pt}

\* Every replica has used its events: the run is over (stutter, so TLC sees no deadlock).
Done == (\A r \in Replicas : vc[r][r] = MaxEvents) /\ UNCHANGED vars

Next ==
    \/ Done
    \/ \E r \in Replicas, pt \in 0..MaxTime :
        \/ Local(r, pt)
        \/ \E m \in log : Receive(r, m, pt)

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------

Stamps == {e.stamp : e \in log} \cup {hlc[r] : r \in Replicas}

TypeOK ==
    /\ \A r \in Replicas :
        /\ hlc[r].wall \in 0..MaxTime
        /\ hlc[r].logical \in Nat
        /\ hlc[r].node = r
    /\ vc \in [Replicas -> [Replicas -> 0..MaxEvents]]
    /\ read \subseteq 0..MaxTime

\* P-HLC-01: stamps are in one strict total order.
CompareTotalOrder ==
    /\ \A a, b \in Stamps :
        \/ Less(a, b) /\ a # b /\ ~Less(b, a)
        \/ ~Less(a, b) /\ a = b /\ ~Less(b, a)
        \/ ~Less(a, b) /\ a # b /\ Less(b, a)
    /\ \A a, b, c \in Stamps : Less(a, b) /\ Less(b, c) => Less(a, c)

\* P-HLC-02: a local tick gives a strictly larger stamp.
TickAdvances ==
    [][\A r \in Replicas, pt \in 0..MaxTime : Local(r, pt) => Less(hlc[r], hlc'[r])]_vars

\* P-HLC-03: a receive gives a stamp strictly larger than the local stamp and the remote stamp.
ReceiveAdvances ==
    [][\A r \in Replicas, pt \in 0..MaxTime : \A m \in log :
        Receive(r, m, pt) => Less(hlc[r], hlc'[r]) /\ LessWL(m.stamp, hlc'[r])]_vars

\* P-HLC-04: a stamp's wall time is never behind the physical clock that made it ...
NotBehindClock ==
    [][\A r \in Replicas, pt \in 0..MaxTime :
        (Local(r, pt) \/ \E m \in log : Receive(r, m, pt)) => hlc'[r].wall >= pt]_vars

\* P-HLC-04: ... and is never invented: it is a physical clock reading some replica made.
NeverInvented == \A r \in Replicas : hlc[r].wall \in read \cup {0}

\* P-HLC-05: if event x happened before event y, x's stamp is smaller; no two events share a stamp.
ClockCondition ==
    \A x, y \in log : x # y =>
        /\ x.stamp # y.stamp
        /\ VLeq(x.vc, y.vc) => Less(x.stamp, y.stamp)

=============================================================================
