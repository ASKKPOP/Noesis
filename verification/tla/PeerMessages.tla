---------------------------- MODULE PeerMessages ----------------------------
(***************************************************************************)
(* Model of how a direct message from one Nous reaches another Nous's      *)
(* Brain.                                                                  *)
(*                                                                         *)
(*   grid/src/integration/nous-runner.ts     case 'direct_message'         *)
(*   grid/src/integration/peer-messages.ts   PeerMessageRouter.deliver     *)
(*   grid/src/civic-presence/message-queue-store.ts  listPending,          *)
(*                                                   markDelivered         *)
(*   brain/src/noesis_brain/rpc/handler.py   _run_peer_inbox_cycle         *)
(*                                                                         *)
(*   SetMute(n, b)   the operator mutes or unmutes n.                      *)
(*   Retire(n)       n loses its active Civic-DID or is deleted.           *)
(*   Send(s, t, b)   s's Brain posts a direct message with text b for t.   *)
(*                   A muted sender does nothing. Otherwise the audit      *)
(*                   chain records who wrote to whom, and the message is   *)
(*                   queued if t is another Nous in good standing.         *)
(*   Poll(p)         Brain process p reads its Nous's pending messages     *)
(*                   (GET /civic/inbox). The answer is a snapshot and can  *)
(*                   go stale.                                             *)
(*   Claim(p, i)     p asks the Grid to mark message i delivered (PATCH    *)
(*                   /civic/inbox/ack with one id). p may ask for any id,  *)
(*                   also one that is not its own. Only if the Grid        *)
(*                   answers "one row changed" does p hand the message to  *)
(*                   on_message.                                           *)
(*   Crash(p)        p restarts and forgets what it had read.              *)
(*                                                                         *)
(* One Nous can have more than one Brain process polling (a restart that   *)
(* overlaps, a second machine), so Poll and Claim interleave freely.       *)
(***************************************************************************)
EXTENDS Naturals, FiniteSets

CONSTANTS Nous, Twin, Texts, MaxSends

ASSUME Twin \in Nous

\* A Brain process is <<its Nous, a copy number>>. Every Nous has one; Twin has two.
Procs == (Nous \X {1}) \cup ({Twin} \X {2})
Owner(p) == p[1]
Ids == 1..MaxSends

VARIABLES
    muted,    \* muted[n]    = the operator has muted n
    good,     \* good[n]     = n holds an active Civic-DID and is not deleted
    queue,    \* the Grid's rows: [id, from, to, text, state, mutedAtSend, goodAtSend]
    audit,    \* the audit chain's nous.direct_message records
    sends,    \* how many Send steps have run (the bound)
    seen,     \* seen[p]     = ids p believes are waiting (possibly stale)
    handed    \* every hand-over to on_message: [id, to] with a count

vars == <<muted, good, queue, audit, sends, seen, handed>>

Row(i) == CHOOSE m \in queue : m.id = i
Queued(i) == \E m \in queue : m.id = i

Init ==
    /\ muted = [n \in Nous |-> FALSE]
    /\ good = [n \in Nous |-> TRUE]
    /\ queue = {}
    /\ audit = {}
    /\ sends = 0
    /\ seen = [p \in Procs |-> {}]
    /\ handed = [i \in Ids |-> {}]

SetMute(n, b) ==
    /\ muted[n] # b
    /\ muted' = [muted EXCEPT ![n] = b]
    /\ UNCHANGED <<good, queue, audit, sends, seen, handed>>

Retire(n) ==
    /\ good[n]
    /\ good' = [good EXCEPT ![n] = FALSE]
    /\ UNCHANGED <<muted, queue, audit, sends, seen, handed>>

Send(s, t, b) ==
    /\ sends < MaxSends
    /\ sends' = sends + 1
    /\ IF muted[s]
       THEN UNCHANGED <<queue, audit>>
       ELSE /\ audit' = audit \cup {[from |-> s, to |-> t]}
            /\ IF t # s /\ good[s] /\ good[t]
               THEN queue' = queue \cup {[id |-> sends + 1, from |-> s, to |-> t, text |-> b,
                                          state |-> "pending",
                                          mutedAtSend |-> muted[s],
                                          goodAtSend |-> good[s] /\ good[t]]}
               ELSE UNCHANGED queue
    /\ UNCHANGED <<muted, good, seen, handed>>

Poll(p) ==
    /\ \E m \in queue : m.to = Owner(p) /\ m.state = "pending" /\ m.id \notin seen[p]
    /\ seen' = [seen EXCEPT ![p] = @ \cup {m.id : m \in {r \in queue : r.to = Owner(p) /\ r.state = "pending"}}]
    /\ UNCHANGED <<muted, good, queue, audit, sends, handed>>

\* The Grid changes the row only if it is pending AND addressed to the caller.
Claim(p, i) ==
    \* no guard on i: a Brain may ask for any id at all
    /\ IF Queued(i) /\ Row(i).state = "pending" /\ Row(i).to = Owner(p)
       THEN /\ queue' = (queue \ {Row(i)}) \cup {[Row(i) EXCEPT !.state = "delivered", !.text = "scrubbed"]}
            /\ handed' = [handed EXCEPT ![i] = @ \cup {[to |-> Owner(p), nth |-> Cardinality(@) + 1]}]
       ELSE UNCHANGED <<queue, handed>>
    /\ seen' = [seen EXCEPT ![p] = @ \ {i}]
    /\ UNCHANGED <<muted, good, audit, sends>>

Crash(p) ==
    /\ seen[p] # {}
    /\ seen' = [seen EXCEPT ![p] = {}]
    /\ UNCHANGED <<muted, good, queue, audit, sends, handed>>

Next ==
    \/ \E n \in Nous, b \in BOOLEAN : SetMute(n, b)
    \/ \E n \in Nous : Retire(n)
    \/ \E s \in Nous, t \in Nous, b \in Texts : Send(s, t, b)
    \/ \E p \in Procs : Poll(p) \/ Crash(p) \/ (\E i \in Ids : Claim(p, i))

\* Fairness for P-DM-06: a Brain that is running keeps polling, and a claim
\* it can make keeps being made even though restarts interrupt it.
Fairness ==
    /\ \A p \in Procs : WF_vars(Poll(p))
    /\ \A p \in Procs, i \in Ids : SF_vars(i \in seen[p] /\ Claim(p, i))

Spec == Init /\ [][Next]_vars /\ Fairness

----------------------------------------------------------------------------

TypeOK ==
    /\ muted \in [Nous -> BOOLEAN]
    /\ good \in [Nous -> BOOLEAN]
    /\ sends \in 0..MaxSends
    /\ \A m \in queue :
        /\ m.id \in Ids /\ m.from \in Nous /\ m.to \in Nous
        /\ m.text \in Texts \cup {"scrubbed"}
        /\ m.state \in {"pending", "delivered"}
    /\ \A m1, m2 \in queue : m1.id = m2.id => m1 = m2
    /\ seen \in [Procs -> SUBSET Ids]
    /\ \A i \in Ids : \A h \in handed[i] : h.to \in Nous

\* P-DM-01: a message is handed to on_message at most once, however many
\* times it is polled, however many Brain processes poll, across restarts.
AtMostOnce == \A i \in Ids : Cardinality(handed[i]) <= 1

\* P-DM-02: a message is handed only to the Brain of the Nous it was sent to.
OnlyToTarget == \A i \in Ids : \A h \in handed[i] : Queued(i) /\ h.to = Row(i).to

\* P-DM-03: nothing sent while the sender is muted is queued (so none is handed over).
NothingFromMuted == \A m \in queue : ~m.mutedAtSend

\* P-DM-04: a message is queued only for another Nous, and only when sender and
\* target both held an active Civic-DID and were not deleted at that moment.
QueuedOnlyForGoodTarget == \A m \in queue : m.to # m.from /\ m.goodAtSend

\* P-DM-05: the audit record says who wrote to whom and never carries the text;
\* the Grid's copy of the text is gone once the message is claimed.
AuditHasNoText ==
    /\ \A e \in audit : DOMAIN e = {"from", "to"}
    /\ \A m \in queue : m.state = "delivered" => m.text = "scrubbed"

\* P-DM-06: a queued message is handed over in the end, as long as the
\* target's Brain keeps polling (Fairness above).
EventuallyHanded == \A i \in Ids : (Queued(i) ~> (Queued(i) /\ Row(i).state = "delivered"))

=============================================================================
