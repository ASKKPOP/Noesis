-------------------------- MODULE PeerMessagesLive --------------------------
(***************************************************************************)
(* The liveness run of PeerMessages.tla: P-DM-06, a queued message is      *)
(* handed over in the end while the target's Brain keeps polling.          *)
(*                                                                         *)
(* It is a run of its own because TLC's liveness check costs far more per  *)
(* state than its safety check. The constants in PeerMessagesLive.cfg      *)
(* leave out lore messages (queued exactly like a direct message), targets *)
(* that are not Nous (never queued) and notices from the Grid (claimed by  *)
(* the same step). That a notice is claimed in the end is checked by the   *)
(* Brain's stateful property test, not here.                               *)
(***************************************************************************)
EXTENDS PeerMessages

=============================================================================
