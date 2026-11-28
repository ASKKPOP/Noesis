----------------------------- MODULE SkillTrust -----------------------------
(***************************************************************************)
(* Model of whom a live-wired Brain trusts to teach it a skill.            *)
(*                                                                         *)
(*   brain/src/noesis_brain/social_logic.py   hot_ties, skill_trust_weight *)
(*   brain/src/noesis_brain/rpc/handler.py    _refresh_hot_ties,           *)
(*                                            on_message (__skill_share:), *)
(*                                            _sweep_quarantine            *)
(*   brain/src/noesis_brain/skills/quarantine.py   sweep                   *)
(*                                                                         *)
(*   TieChanges(p, b)  the tie between the Brain's Nous and p warms or     *)
(*                     cools on the Grid.                                  *)
(*   Break / Heal      the Grid's ties route stops or starts answering.    *)
(*   Read              the Brain reads its ties. It keeps the hot ones; a  *)
(*                     read that fails leaves it with nobody.              *)
(*   Teach(p)          a skill from p arrives. The Brain reads its ties    *)
(*                     first, then quarantines the skill only if p is one  *)
(*                     of the hot ties it just read.                       *)
(*   Sweep(i)          quarantined skill i is due. It joins the skills     *)
(*                     only if its teacher is among the hot ties of the    *)
(*                     Brain's latest read; otherwise it is thrown away.   *)
(*                                                                         *)
(* The Brain holds no numeric weights here: that is the live-wired case.   *)
(* Read and Sweep are separate steps, so a tie can cool between them.      *)
(***************************************************************************)
EXTENDS Naturals, FiniteSets

CONSTANTS Peers, MaxSkills

Buckets == {"cold", "warm", "hot"}
Ids == 1..MaxSkills

VARIABLES
    bucket,     \* bucket[p]   = the tie's warmth on the Grid right now
    up,         \* the ties route answers
    known,      \* the hot ties the Brain kept from its latest read
    seenAs,     \* seenAs[p]   = what the latest read said about p ("none" = no answer)
    skills,     \* [id, from, state, atArrival, atSweep]
    taught      \* how many skills have arrived (the bound)

vars == <<bucket, up, known, seenAs, skills, taught>>

HotNow == {p \in Peers : bucket[p] = "hot"}

Init ==
    /\ bucket = [p \in Peers |-> "cold"]
    /\ up = TRUE
    /\ known = {}
    /\ seenAs = [p \in Peers |-> "none"]
    /\ skills = {}
    /\ taught = 0

TieChanges(p, b) ==
    /\ bucket[p] # b
    /\ bucket' = [bucket EXCEPT ![p] = b]
    /\ UNCHANGED <<up, known, seenAs, skills, taught>>

Flip ==
    /\ up' = ~up
    /\ UNCHANGED <<bucket, known, seenAs, skills, taught>>

\* What a read leaves the Brain with.
ReadKnown == IF up THEN HotNow ELSE {}
ReadSeen == IF up THEN bucket ELSE [p \in Peers |-> "none"]

Read ==
    /\ known' = ReadKnown
    /\ seenAs' = ReadSeen
    /\ UNCHANGED <<bucket, up, skills, taught>>

Teach(p) ==
    /\ taught < MaxSkills
    /\ taught' = taught + 1
    /\ known' = ReadKnown
    /\ seenAs' = ReadSeen
    /\ skills' = skills \cup {[id |-> taught + 1, from |-> p,
                               state |-> IF p \in ReadKnown THEN "quarantined" ELSE "refused",
                               atArrival |-> ReadSeen[p], atSweep |-> "none"]}
    /\ UNCHANGED <<bucket, up>>

Sweep(s) ==
    /\ s \in skills /\ s.state = "quarantined"
    /\ skills' = (skills \ {s}) \cup
                 {[s EXCEPT !.state = IF s.from \in known THEN "active" ELSE "evicted",
                            !.atSweep = seenAs[s.from]]}
    /\ UNCHANGED <<bucket, up, known, seenAs, taught>>

Next ==
    \/ \E p \in Peers, b \in Buckets : TieChanges(p, b)
    \/ Flip
    \/ Read
    \/ \E p \in Peers : Teach(p)
    \/ \E s \in skills : Sweep(s)

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------

TypeOK ==
    /\ bucket \in [Peers -> Buckets]
    /\ up \in BOOLEAN
    /\ known \subseteq Peers
    /\ seenAs \in [Peers -> Buckets \cup {"none"}]
    /\ taught \in 0..MaxSkills
    /\ \A s \in skills :
        /\ s.id \in Ids /\ s.from \in Peers
        /\ s.state \in {"quarantined", "refused", "active", "evicted"}
    /\ \A s1, s2 \in skills : s1.id = s2.id => s1 = s2

\* P-SKILLTRUST-01: the Brain trusts exactly the peers its latest read called hot —
\* never a warm, cold or unlisted one.
TrustedOnlyIfReadHot == \A p \in Peers : p \in known <=> seenAs[p] = "hot"

\* P-SKILLTRUST-02: a read that got no answer leaves nobody trusted.
NoAnswerTrustsNobody == (\E p \in Peers : seenAs[p] = "none") => known = {}

\* P-SKILLTRUST-03: a taught skill is held (quarantined, or later active) only if the
\* read made at its arrival called its teacher hot, and it joins the skills only if
\* the Brain's latest read at the sweep called the teacher hot again.
HeldOnlyFromHot ==
    \A s \in skills :
        /\ s.state \in {"quarantined", "active", "evicted"} => s.atArrival = "hot"
        /\ s.state = "active" => s.atSweep = "hot"

=============================================================================
