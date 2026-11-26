----------------------------- MODULE CardMerge -----------------------------
(***************************************************************************)
(* Model of one knowledge card replicated by KnowledgePool                 *)
(* (protocol/src/knowledge.ts).                                            *)
(*                                                                         *)
(*   Write(r, pt, del)  models  updateCard / confirmKnowledge (del=FALSE)  *)
(*                              and deleteCard (del=TRUE), Date.now()=pt   *)
(*   Deliver(r, m)      models  mergeCard(m) at replica r                  *)
(*                                                                         *)
(* Replica 1 creates the card (its first write). Every state a replica     *)
(* ever held stays deliverable, so cards may be delayed, repeated and      *)
(* reordered. The physical clock reading pt is any value in 0..MaxTime at  *)
(* every write, so clocks may disagree and may go backward.                *)
(*                                                                         *)
(* Replica 1 is the card's author. A card has two parts. The authored part *)
(* (title, content, deleted flag, ...) is signed by the author; it is      *)
(* modelled as auth, the number of the author's write it came from, with   *)
(* tomb. The part any node may change (confidence, verification status)    *)
(* is modelled as val, the id <<node, seq>> of the write it came from.     *)
(* signed is every (auth, tomb) pair the author has signed: a signature    *)
(* cannot be made by anyone else. Bad stands for any stamp field that is   *)
(* not a whole number >= 0.                                                *)
(***************************************************************************)
EXTENDS Integers, FiniteSets

CONSTANTS Replicas, MaxWrites, MaxTime

VARIABLES has,      \* has[r]  = replica r holds the card
          card,     \* card[r] = [vc, stamp, val, auth, tomb]
          msgs,     \* every card state ever held (all stay deliverable)
          log,      \* every write so far: [id, stamp, del, seen]
          signed    \* every [auth, tomb] the author has signed

vars == <<has, card, msgs, log, signed>>

Author == 1

Max(a, b) == IF a >= b THEN a ELSE b

\* compareHLC(a, b) < 0
Less(a, b) ==
    \/ a.wall < b.wall
    \/ a.wall = b.wall /\ a.logical < b.logical
    \/ a.wall = b.wall /\ a.logical = b.logical /\ a.node < b.node

\* A local write's stamp: tickHLC on the card's stamp, as the writing node.
WriteStamp(s, pt, r) ==
    IF pt > s.wall
        THEN [wall |-> pt, logical |-> 0, node |-> r]
        ELSE [wall |-> s.wall, logical |-> s.logical + 1, node |-> r]

VLeq(a, b) == \A n \in Replicas : a[n] <= b[n]
VMerge(a, b) == [n \in Replicas |-> Max(a[n], b[n])]

Bad == -1
ValidStamp(s) == s.wall \in Nat /\ s.logical \in Nat

\* The same cards with a stamp field a peer has made invalid.
InvalidMsgs ==
    {[m EXCEPT !.stamp.wall = Bad] : m \in msgs} \cup {[m EXCEPT !.stamp.logical = Bad] : m \in msgs}

\* verifyCardAuthorship: the authored part is one the author signed, for the
\* author write count the card claims.
Signed(m) == m.auth = m.vc[Author] /\ [auth |-> m.auth, tomb |-> m.tomb] \in signed

\* The same cards with the authored part changed by someone who is not the author:
\* the deleted flag flipped, another author write claimed, the author's count raised.
ForgedMsgs ==
    {f \in {[m EXCEPT !.tomb = ~m.tomb] : m \in msgs}
            \cup {[m EXCEPT !.auth = k] : m \in msgs, k \in 0..MaxWrites}
            \cup {[m EXCEPT !.vc[Author] = @ + 1] : m \in msgs} : ~Signed(f)}

Zero == [n \in Replicas |-> 0]
First == [vc    |-> [Zero EXCEPT ![1] = 1],
          stamp |-> [wall |-> 0, logical |-> 0, node |-> 1],
          val   |-> <<1, 1>>,
          auth  |-> 1,
          tomb  |-> FALSE]

Init ==
    /\ has = [r \in Replicas |-> r = 1]
    /\ card = [r \in Replicas |-> First]
    /\ msgs = {First}
    /\ log = {[id |-> <<1, 1>>, stamp |-> First.stamp, del |-> FALSE, seen |-> First.vc]}
    /\ signed = {[auth |-> 1, tomb |-> FALSE]}

Write(r, pt, del) ==
    /\ has[r]
    /\ Cardinality(log) < MaxWrites
    /\ del => r = Author                                     \* deleteCard: the author only
    /\ LET s == WriteStamp(card[r].stamp, pt, r)
           v == [card[r].vc EXCEPT ![r] = @ + 1]
           id == <<r, v[r]>>
           c == [vc |-> v, stamp |-> s, val |-> id,
                 auth |-> IF r = Author THEN v[r] ELSE card[r].auth,
                 tomb |-> card[r].tomb \/ del]
       IN /\ card' = [card EXCEPT ![r] = c]
          /\ msgs' = msgs \cup {c}
          /\ log' = log \cup {[id |-> id, stamp |-> s, del |-> del, seen |-> v]}
          \* the author signs the authored part on each of its writes
          /\ signed' = IF r = Author THEN signed \cup {[auth |-> c.auth, tomb |-> c.tomb]} ELSE signed
    /\ UNCHANGED has

\* mergeCard, once the remote card has passed validation.
Merged(l, m) ==
    IF VLeq(m.vc, l.vc)
        THEN l                                               \* equal or stale: discard
        ELSE [vc    |-> VMerge(l.vc, m.vc),
              stamp |-> IF Less(l.stamp, m.stamp) THEN m.stamp ELSE l.stamp,
              val   |-> IF VLeq(l.vc, m.vc) THEN m.val       \* remote strictly newer
                        ELSE IF Less(l.stamp, m.stamp) THEN m.val ELSE l.val,
              \* the authored part, whole, from the card with the newer author write
              auth  |-> IF m.vc[Author] > l.vc[Author] THEN m.auth ELSE l.auth,
              tomb  |-> IF m.vc[Author] > l.vc[Author] THEN m.tomb ELSE l.tomb]

Deliver(r, m) ==
    IF ValidStamp(m.stamp) /\ Signed(m)
        THEN LET c == IF has[r] THEN Merged(card[r], m) ELSE m
             IN /\ has' = [has EXCEPT ![r] = TRUE]
                /\ card' = [card EXCEPT ![r] = c]
                /\ msgs' = msgs \cup {c}
                /\ UNCHANGED <<log, signed>>
        ELSE UNCHANGED vars                                  \* rejected

Next ==
    \E r \in Replicas :
        \/ \E pt \in 0..MaxTime, del \in BOOLEAN : Write(r, pt, del)
        \/ \E m \in msgs \cup InvalidMsgs \cup ForgedMsgs : Deliver(r, m)

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------

Holders == {r \in Replicas : has[r]}

Covered(id, v) == id[2] <= v[id[1]]
SeenBy(r) == {w \in log : Covered(w.id, card[r].vc)}

TypeOK ==
    /\ has \in [Replicas -> BOOLEAN]
    /\ \A r \in Replicas :
        /\ card[r].vc \in [Replicas -> 0..MaxWrites]
        /\ card[r].tomb \in BOOLEAN
        /\ card[r].val[1] \in Replicas

\* P-CARD-01: replicas that have seen the same writes hold the same card.
Converged ==
    \A r, s \in Holders : card[r].vc = card[s].vc => card[r] = card[s]

\* P-CARD-02: the part any node may change is that of the write with the largest stamp
\* among the writes the replica has seen.
LastWriteWins ==
    \A r \in Holders :
        \E w \in SeenBy(r) :
            /\ w.id = card[r].val
            /\ w.stamp = card[r].stamp
            /\ \A x \in SeenBy(r) : ~Less(w.stamp, x.stamp)

\* P-CARD-03: delivering a card the replica has already seen changes nothing.
StaleChangesNothing ==
    [][\A r \in Replicas : \A m \in msgs :
        (Deliver(r, m) /\ has[r] /\ VLeq(m.vc, card[r].vc)) => card' = card]_vars

\* P-CARD-04: a replica's card is deleted exactly when it has seen a delete (by the author).
DeletedIffDeleteSeen ==
    \A r \in Holders : card[r].tomb <=> \E w \in SeenBy(r) : w.del

\* P-CARD-05: a replica's card never goes backward: clock, stamp, deleted flag.
NeverBackward ==
    [][\A r \in Holders :
        /\ has'[r]
        /\ VLeq(card[r].vc, card'[r].vc)
        /\ ~Less(card'[r].stamp, card[r].stamp)
        /\ card[r].tomb => card'[r].tomb]_vars

\* P-CARD-06: every stored stamp is valid ...
AllStampsValid == \A r \in Holders : ValidStamp(card[r].stamp)

\* P-CARD-06: ... and a card whose stamp is not valid changes nothing.
InvalidChangesNothing ==
    [][\A r \in Replicas : \A m \in InvalidMsgs : Deliver(r, m) => UNCHANGED vars]_vars

\* P-CARD-07: the authored part is that of the author's newest write the replica has seen ...
AuthoredIsAuthorsNewest ==
    /\ \A r \in Holders : card[r].auth = card[r].vc[Author]
    /\ \A w \in log : w.del => w.id[1] = Author

\* P-CARD-07: ... and a write by anyone else never changes it.
OthersKeepAuthored ==
    [][\A r \in Replicas \ {Author} : \A pt \in 0..MaxTime :
        Write(r, pt, FALSE) => card'[r].auth = card[r].auth /\ card'[r].tomb = card[r].tomb]_vars

\* P-CARD-08: every stored card carries an authored part the author signed ...
AllSigned == \A r \in Holders : Signed(card[r])

\* P-CARD-08: ... and a card whose authored part the author did not sign changes nothing.
ForgedChangesNothing ==
    [][\A r \in Replicas : \A m \in ForgedMsgs : Deliver(r, m) => UNCHANGED vars]_vars

\* P-HLC-05: a write's stamp is larger than the stamp of every write it had seen;
\* no two writes share a stamp.
ClockCondition ==
    \A x, y \in log : x # y =>
        /\ x.stamp # y.stamp
        /\ Covered(x.id, y.seen) => Less(x.stamp, y.stamp)

=============================================================================
