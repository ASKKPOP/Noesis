---------------------------- MODULE SocialPeers ----------------------------
(***************************************************************************)
(* Model of how the Brain's social cycle builds and uses its list of       *)
(* trusted peers.                                                          *)
(*                                                                         *)
(*   brain/src/noesis_brain/social_logic.py   trusted_peers                *)
(*   brain/src/noesis_brain/rpc/handler.py    _run_social_cycle            *)
(*                                                                         *)
(*   Drift(d, b)   the Grid's tie with d moves to bucket b. Ties change on *)
(*                 their own, at any time, also while a cycle is thinking. *)
(*   Fetch(c)      cycle c reads the ties and builds its list              *)
(*                 (wire.fetch_relationships, then trusted_peers). A failed *)
(*                 or unusable read is the empty list.                     *)
(*   Decide(c, d)  the model answers with any DID d at all. The cycle      *)
(*                 queues a message only if d is on the list it built.     *)
(*                                                                         *)
(* A cycle runs as a background task, so two can be in flight together.    *)
(* Which trusted peers make the list (order, hot before warm) is the pure  *)
(* function's business and is checked in Lean and by the property tests;   *)
(* here Fetch may list any trusted peers up to the limit. A numeric weight *)
(* of at least 0.3 counts as a trusted standing.                           *)
(***************************************************************************)
EXTENDS Naturals, FiniteSets

CONSTANTS Others, Self, Cycles, MaxPeers

Dids == Others \cup {Self}
Standing == {"cold", "warm", "hot"}
Trusted(b) == b \in {"warm", "hot"}

VARIABLES
    tie,    \* tie[d]   = the standing the Grid holds for d right now
    phase,  \* phase[c] = "idle" or "listed"
    list,   \* list[c]  = the DIDs cycle c listed, each with the standing it had when listed
    sent    \* every message queued: who to, and the standing they had when listed

vars == <<tie, phase, list, sent>>

NoList == [d \in {} |-> "cold"]

Init ==
    /\ tie = [d \in Dids |-> "cold"]
    /\ phase = [c \in Cycles |-> "idle"]
    /\ list = [c \in Cycles |-> NoList]
    /\ sent = {}

Drift(d, b) ==
    /\ tie[d] # b
    /\ tie' = [tie EXCEPT ![d] = b]
    /\ UNCHANGED <<phase, list, sent>>

Fetch(c) ==
    /\ phase[c] = "idle"
    /\ \E S \in SUBSET {d \in Others : Trusted(tie[d])} :
        /\ Cardinality(S) <= MaxPeers
        /\ list' = [list EXCEPT ![c] = [d \in S |-> tie[d]]]
    /\ phase' = [phase EXCEPT ![c] = "listed"]
    /\ UNCHANGED <<tie, sent>>

Decide(c, d) ==
    /\ phase[c] = "listed"
    /\ sent' = IF d \in DOMAIN list[c]
               THEN sent \cup {[to |-> d, was |-> list[c][d]]}
               ELSE sent
    /\ phase' = [phase EXCEPT ![c] = "idle"]
    /\ list' = [list EXCEPT ![c] = NoList]
    /\ UNCHANGED tie

Next ==
    \/ \E d \in Dids, b \in Standing : Drift(d, b)
    \/ \E c \in Cycles : Fetch(c) \/ (\E d \in Dids : Decide(c, d))

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------

TypeOK ==
    /\ tie \in [Dids -> Standing]
    /\ phase \in [Cycles -> {"idle", "listed"}]
    /\ \A c \in Cycles : DOMAIN list[c] \subseteq Dids
    /\ \A c \in Cycles : \A d \in DOMAIN list[c] : list[c][d] \in Standing
    /\ \A c \in Cycles : Cardinality(DOMAIN list[c]) <= MaxPeers
    /\ \A m \in sent : m.to \in Dids /\ m.was \in Standing

\* P-SOCIAL-04: whatever DID the model names, a message is queued only to a
\* peer on the list built in that same cycle — so never to the mind itself
\* and never to a peer that was cold when the list was built.
OnlyToListedPeers == \A m \in sent : m.to # Self /\ Trusted(m.was)

=============================================================================
