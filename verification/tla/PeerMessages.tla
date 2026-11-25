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
(*   Send(s, t, k, ok, b)                                                  *)
(*                   s's Brain posts a message of kind k (a direct         *)
(*                   message, or a lore request or response) with          *)
(*                   text b for t. ok says whether a lore message is in    *)
(*                   its exact wire form. A muted sender does nothing, and *)
(*                   a lore message not in its wire form is dropped whole. *)
(*                   Otherwise the audit chain records who wrote to whom   *)
(*                   under which channel, and the message is queued if t   *)
(*                   is another Nous in good standing. t may also be one   *)
(*                   of Others: a DID that holds a Civic-DID but is not a  *)
(*                   Nous.                                                 *)
(*   Notify(n)       the Grid itself writes a notice into n's inbox        *)
(*                   (civic-presence/escalation-check.ts).                 *)
(*   Poll(p)         Brain process p reads its Nous's pending messages     *)
(*                   (GET /civic/inbox). The answer is a snapshot and can  *)
(*                   go stale.                                             *)
(*   Claim(p, i)     p asks the Grid to mark message i delivered (PATCH    *)
(*                   /civic/inbox/ack with one id). p may ask for any id,  *)
(*                   also one that is not its own. Only if the Grid        *)
(*                   answers "one row changed" does p hand the message to  *)
(*                   on_message — or, for a notice from the Grid, write    *)
(*                   it to memory.                                         *)
(*   Crash(p)        p restarts and forgets what it had read.              *)
(*                                                                         *)
(* One Nous can have more than one Brain process polling (a restart that   *)
(* overlaps, a second machine), so Poll and Claim interleave freely.       *)
(***************************************************************************)
EXTENDS Naturals, FiniteSets

\* Others: DIDs that hold a Civic-DID but are not Nous.
\* Kinds:  what a Nous may send. "lore" stands for both a lore request and a lore
\*         response: the runner treats the two alike (check the wire form, record, queue).
\* Notices: whether the Grid itself writes notices into inboxes.
CONSTANTS Nous, Twin, Others, GridSender, Kinds, Notices, Texts, MaxSends

ASSUME Twin \in Nous
ASSUME Others \cap Nous = {} /\ GridSender \notin Nous \cup Others
ASSUME Kinds \subseteq {"direct", "lore"} /\ Notices \in BOOLEAN

\* A Brain process is <<its Nous, a copy number>>. Every Nous has one; Twin has two.
Procs == (Nous \X {1}) \cup ({Twin} \X {2})
Owner(p) == p[1]
Ids == 1..MaxSends

VARIABLES
    muted,    \* muted[n]    = the operator has muted n
    good,     \* good[n]     = n holds an active Civic-DID and is not deleted
    queue,    \* the Grid's rows: [id, from, to, kind, text, state, mutedAtSend, goodAtSend, formOk]
    audit,    \* the audit chain's nous.direct_message records
    badAudit, \* TRUE once a record was written for a message that was dropped for its form
    sends,    \* how many Send steps have run (the bound)
    seen,     \* seen[p]     = ids p believes are waiting (possibly stale)
    handed,   \* every hand-over to on_message: [id, to] with a count
    noted     \* every notice written to memory: [id, to] with a count

vars == <<muted, good, queue, audit, badAudit, sends, seen, handed, noted>>

Row(i) == CHOOSE m \in queue : m.id = i
Queued(i) == \E m \in queue : m.id = i

Init ==
    /\ muted = [n \in Nous |-> FALSE]
    /\ good = [n \in Nous |-> TRUE]
    /\ queue = {}
    /\ audit = {}
    /\ badAudit = FALSE
    /\ sends = 0
    /\ seen = [p \in Procs |-> {}]
    /\ handed = [i \in Ids |-> {}]
    /\ noted = [i \in Ids |-> {}]

SetMute(n, b) ==
    /\ muted[n] # b
    /\ muted' = [muted EXCEPT ![n] = b]
    /\ UNCHANGED <<good, queue, audit, badAudit, sends, seen, handed, noted>>

Retire(n) ==
    /\ good[n]
    /\ good' = [good EXCEPT ![n] = FALSE]
    /\ UNCHANGED <<muted, queue, audit, badAudit, sends, seen, handed, noted>>

Send(s, t, k, ok, b) ==
    /\ sends < MaxSends
    /\ sends' = sends + 1
    /\ IF muted[s] \/ (k # "direct" /\ ~ok)
       THEN UNCHANGED <<queue, audit>>
       ELSE /\ audit' = audit \cup {[from |-> s, to |-> t, channel |-> k]}
            /\ IF t \in Nous /\ t # s /\ good[s] /\ good[t]
               THEN queue' = queue \cup {[id |-> sends + 1, from |-> s, to |-> t, kind |-> k, text |-> b,
                                          state |-> "pending",
                                          mutedAtSend |-> muted[s],
                                          goodAtSend |-> good[s] /\ good[t],
                                          formOk |-> (k = "direct" \/ ok)]}
               ELSE UNCHANGED queue
    \* Ghost for P-DM-08: did a message dropped for its form still add a record?
    /\ badAudit' = (badAudit \/ (k # "direct" /\ ~ok /\ audit' # audit))
    /\ UNCHANGED <<muted, good, seen, handed, noted>>

Notify(n) ==
    /\ sends < MaxSends
    /\ sends' = sends + 1
    /\ queue' = queue \cup {[id |-> sends + 1, from |-> GridSender, to |-> n, kind |-> "notice", text |-> "notice",
                               state |-> "pending", mutedAtSend |-> FALSE, goodAtSend |-> TRUE, formOk |-> TRUE]}
    /\ UNCHANGED <<muted, good, audit, badAudit, seen, handed, noted>>

Poll(p) ==
    /\ \E m \in queue : m.to = Owner(p) /\ m.state = "pending" /\ m.id \notin seen[p]
    /\ seen' = [seen EXCEPT ![p] = @ \cup {m.id : m \in {r \in queue : r.to = Owner(p) /\ r.state = "pending"}}]
    /\ UNCHANGED <<muted, good, queue, audit, badAudit, sends, handed, noted>>

\* The Grid changes the row only if it is pending AND addressed to the caller.
Claim(p, i) ==
    \* no guard on i: a Brain may ask for any id at all
    /\ IF Queued(i) /\ Row(i).state = "pending" /\ Row(i).to = Owner(p)
       THEN /\ queue' = (queue \ {Row(i)}) \cup {[Row(i) EXCEPT !.state = "delivered", !.text = "scrubbed"]}
            \* A notice from the Grid goes to memory; anything else to on_message.
            /\ IF Row(i).kind = "notice"
               THEN /\ noted' = [noted EXCEPT ![i] = @ \cup {[to |-> Owner(p), nth |-> Cardinality(@) + 1]}]
                    /\ UNCHANGED handed
               ELSE /\ handed' = [handed EXCEPT ![i] = @ \cup {[to |-> Owner(p), nth |-> Cardinality(@) + 1]}]
                    /\ UNCHANGED noted
       ELSE UNCHANGED <<queue, handed, noted>>
    /\ seen' = [seen EXCEPT ![p] = @ \ {i}]
    /\ UNCHANGED <<muted, good, audit, badAudit, sends>>

Crash(p) ==
    /\ seen[p] # {}
    /\ seen' = [seen EXCEPT ![p] = {}]
    /\ UNCHANGED <<muted, good, queue, audit, badAudit, sends, handed, noted>>

Next ==
    \/ \E n \in Nous, b \in BOOLEAN : SetMute(n, b)
    \/ \E n \in Nous : Retire(n)
    \* A direct message has no wire form to fail, so ok is fixed for it.
    \/ \E s \in Nous, t \in Nous \cup Others, k \in Kinds, ok \in BOOLEAN, b \in Texts :
          (k = "direct" => ok) /\ Send(s, t, k, ok, b)
    \/ Notices /\ \E n \in Nous : Notify(n)
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
        /\ m.id \in Ids /\ m.from \in Nous \cup {GridSender} /\ m.to \in Nous
        /\ m.kind \in Kinds \cup {"notice"}
        /\ m.text \in Texts \cup {"notice", "scrubbed"}
        /\ m.state \in {"pending", "delivered"}
    /\ \A m1, m2 \in queue : m1.id = m2.id => m1 = m2
    /\ seen \in [Procs -> SUBSET Ids]
    /\ \A i \in Ids : \A h \in handed[i] \cup noted[i] : h.to \in Nous
    /\ badAudit \in BOOLEAN

\* P-DM-01: a message is handed to on_message at most once, however many
\* times it is polled, however many Brain processes poll, across restarts.
AtMostOnce == \A i \in Ids : Cardinality(handed[i]) + Cardinality(noted[i]) <= 1

\* P-DM-02: a message is handed only to the Brain of the Nous it was sent to.
OnlyToTarget == \A i \in Ids : \A h \in handed[i] \cup noted[i] : Queued(i) /\ h.to = Row(i).to

\* P-DM-03: nothing sent while the sender is muted is queued (so none is handed over).
NothingFromMuted == \A m \in queue : ~m.mutedAtSend

\* P-DM-04: a message is queued only for another Nous the registry knows (never
\* for one of Others), and only when sender and target both held an active Civic-DID
\* and were not deleted at that moment.
QueuedOnlyForGoodTarget == \A m \in queue : m.to \in Nous /\ m.to # m.from /\ m.goodAtSend

\* P-DM-05: the audit record says who wrote to whom and never carries the text;
\* the Grid's copy of the text is gone once the message is claimed.
AuditHasNoText ==
    /\ \A e \in audit : DOMAIN e = {"from", "to", "channel"}
    /\ \A m \in queue : m.state = "delivered" => m.text = "scrubbed"

\* P-DM-06: a queued message is handed over in the end, as long as the
\* target's Brain keeps polling (Fairness above). Checked by PeerMessagesLive.cfg.
EventuallyHanded == \A i \in Ids : (Queued(i) ~> (Queued(i) /\ Row(i).state = "delivered"))

\* P-DM-07: whatever a Nous has queued for another — a direct message, a lore
\* request, a lore response — has an audit record naming both and the channel.
QueuedIsAudited ==
    \A m \in queue : m.kind # "notice" => [from |-> m.from, to |-> m.to, channel |-> m.kind] \in audit

\* P-DM-08: a lore message that is not in its wire form is dropped whole: it is
\* not queued and it leaves no audit record.
OnlyWireForm == (\A m \in queue : m.formOk) /\ ~badAudit

\* P-DM-09: a notice from the Grid is written to memory when it is claimed, never
\* handed to on_message and never dropped; a message from a Nous is never
\* written to memory as a notice.
NoticeIsRemembered ==
    \A m \in queue :
        IF m.kind = "notice"
        THEN handed[m.id] = {} /\ (m.state = "delivered" => Cardinality(noted[m.id]) = 1)
        ELSE noted[m.id] = {} /\ (m.state = "delivered" => Cardinality(handed[m.id]) = 1)

=============================================================================
