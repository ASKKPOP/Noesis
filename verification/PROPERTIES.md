# Property registry

One row per property. Each of the three cells names the file that carries the property's ID, or `N/A (V-9.n)`.
Rules: `.planning/implementation/verification.md`. Checked by `scripts/check-verification.mjs`.

Run the model legs with `./verification/run.sh`; the property tests run in each package's test suite.

| ID | Property | TLA+ | Lean | Property test |
|----|----------|------|------|---------------|
| P-VCLOCK-01 | Merging two vector clocks gives the same result in either order. | verification/tla/VectorClock.tla | verification/lean/Verification/VectorClock.lean | protocol/test/unit/vector-clock.property.test.ts |
| P-VCLOCK-02 | Merging three vector clocks gives the same result however they are grouped. | verification/tla/VectorClock.tla | verification/lean/Verification/VectorClock.lean | protocol/test/unit/vector-clock.property.test.ts |
| P-VCLOCK-03 | Merging a vector clock with itself changes nothing. | verification/tla/VectorClock.tla | verification/lean/Verification/VectorClock.lean | protocol/test/unit/vector-clock.property.test.ts |
| P-VCLOCK-04 | A merge is at least as large as both inputs. | verification/tla/VectorClock.tla | verification/lean/Verification/VectorClock.lean | protocol/test/unit/vector-clock.property.test.ts |
| P-VCLOCK-05 | No replica knows a higher count for replica r than r itself holds. | verification/tla/VectorClock.tla | verification/lean/Verification/VectorClock.lean | protocol/test/unit/vector-clock.property.test.ts |
| P-VCLOCK-06 | A replica's clock never goes backward. | verification/tla/VectorClock.tla | verification/lean/Verification/VectorClock.lean | protocol/test/unit/vector-clock.property.test.ts |
| P-VCLOCK-07 | Every stored vector clock count is a whole number ≥ 0, and merging two valid clocks gives a valid clock. | verification/tla/VectorClock.tla | verification/lean/Verification/VectorClock.lean | protocol/test/unit/vector-clock.property.test.ts |
| P-VCLOCK-08 | A card from the network whose vector clock is not valid is rejected and changes nothing. | verification/tla/VectorClock.tla | verification/lean/Verification/VectorClock.lean | protocol/test/unit/vector-clock.property.test.ts |
| P-HLC-01 | Hybrid clock stamps are in one strict total order: of any two, exactly one is smaller or they are the same stamp. | verification/tla/HybridClock.tla | verification/lean/Verification/HybridClock.lean | protocol/test/unit/hybrid-clock.property.test.ts |
| P-HLC-02 | A local tick gives a strictly larger stamp. | verification/tla/HybridClock.tla | verification/lean/Verification/HybridClock.lean | protocol/test/unit/hybrid-clock.property.test.ts |
| P-HLC-03 | A receive gives a stamp strictly larger than the local stamp and the remote stamp. | verification/tla/HybridClock.tla | verification/lean/Verification/HybridClock.lean | protocol/test/unit/hybrid-clock.property.test.ts |
| P-HLC-04 | A stamp's wall time is never behind the physical clock that made it and is never invented: it is that clock reading or a wall time the stamp was built from. | verification/tla/HybridClock.tla | verification/lean/Verification/HybridClock.lean | protocol/test/unit/hybrid-clock.property.test.ts |
| P-HLC-05 | If one write or event was seen before another was made, its stamp is smaller; no two share a stamp. | verification/tla/HybridClock.tla | verification/lean/Verification/HybridClock.lean | protocol/test/unit/hybrid-clock.property.test.ts |
| P-CARD-01 | Replicas that have seen the same writes to a card hold the same card, whatever order the writes arrived in. | verification/tla/CardMerge.tla | verification/lean/Verification/CardMerge.lean | protocol/test/unit/card-merge.property.test.ts |
| P-CARD-02 | A replica shows the write with the largest stamp among the writes it has seen. | verification/tla/CardMerge.tla | verification/lean/Verification/CardMerge.lean | protocol/test/unit/card-merge.property.test.ts |
| P-CARD-03 | Delivering a card the replica has already seen changes nothing. | verification/tla/CardMerge.tla | verification/lean/Verification/CardMerge.lean | protocol/test/unit/card-merge.property.test.ts |
| P-CARD-04 | A replica's card is deleted exactly when it has seen a delete; a deleted card stays deleted. | verification/tla/CardMerge.tla | verification/lean/Verification/CardMerge.lean | protocol/test/unit/card-merge.property.test.ts |
| P-CARD-05 | A replica's card never goes backward: not its vector clock, not its stamp, not its deleted flag. | verification/tla/CardMerge.tla | verification/lean/Verification/CardMerge.lean | protocol/test/unit/card-merge.property.test.ts |
| P-CARD-06 | A card from the network whose stamp is not valid, or that carries no clocks, is rejected and changes nothing; every stored stamp is valid. | verification/tla/CardMerge.tla | verification/lean/Verification/HybridClock.lean | protocol/test/unit/card-merge.property.test.ts |
| P-SOCIAL-01 | A trusted peer is another Nous whose tie is hot or warm, or whose known weight is at least 0.3: never a cold or unknown one, never the mind itself. | N/A (V-9.2) pure function, no state between calls | verification/lean/Verification/SocialPeers.lean | brain/test/test_social_peers_properties.py |
| P-SOCIAL-02 | The trusted-peer list has at most three entries and none twice. | N/A (V-9.2) pure function, no state between calls | verification/lean/Verification/SocialPeers.lean | brain/test/test_social_peers_properties.py |
| P-SOCIAL-03 | A peer from a later source (weight, then hot, then warm) is listed only if every peer from the earlier sources is listed. | N/A (V-9.2) pure function, no state between calls | verification/lean/Verification/SocialPeers.lean | brain/test/test_social_peers_properties.py |
| P-SOCIAL-04 | Whatever DID the model names, the social cycle queues a message or a taught skill only to a peer on the list it built in that same cycle. | verification/tla/SocialPeers.tla | verification/lean/Verification/SocialPeers.lean | brain/test/test_social_peers_properties.py |
| P-DM-01 | A direct message is handed to the target Brain's `on_message` at most once, however often it is polled, however many Brain processes poll for that Nous, and across restarts. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-02 | A direct message is shown to, and handed to, only the Brain of the Nous it was addressed to. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-03 | Nothing a Nous sends while it is muted — a direct message, a lore request or a lore response — is queued for anyone. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-04 | A message is queued only for another Nous that this Grid's registry knows — never for a DID that is not a Nous, even one that holds a Civic-DID — only when sender and target both hold an active Civic-DID and are not deleted, and only with a text of 1 to 16,384 characters; a Brain hands to `on_message` only a well-formed direct message from another Nous. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-05 | The audit record of a direct message is the target, the channel and the tick, never the text; the Grid's copy of the text is emptied when the message is claimed. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-06 | A queued message is handed over in the end, as long as the target's Brain keeps polling and is not stopped between claiming a message and handling it. | verification/tla/PeerMessagesLive.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-07 | Whatever one Nous has queued for another — a direct message, a lore request or a lore response — has a `nous.direct_message` audit record naming the sender, the target, the channel and the tick, written before it is queued and never carrying the text. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-08 | A lore request is sent only with a content hash of 64 lowercase hex characters, and a lore response only as `__lore_response:<that hash>:<base64>` within the text limit; anything else sent as one is dropped whole: nothing is queued and no audit record is written. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-09 | A notice the Grid itself puts in a Nous's inbox is written to that Nous's memory when its Brain claims it — at most once, never handed to `on_message`, never dropped unread; a row a Nous sent is never taken for one. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | brain/test/test_peer_inbox_properties.py |

## Stated limits

- **P-VCLOCK-01…06** hold for clocks that pass `isValidVectorClock` (every count a whole number ≥ 0).
  `mergeCard` rejects any other clock (P-VCLOCK-08); `mergeVectorClocks` itself does not check its inputs.
- A peer that sends a well-formed clock with **false** counts (claiming ticks it never made) is not detected.
- Cards loaded from local storage at start-up are not re-validated.
- In the models, one marker stands for every bad count: `Bad` (−1) in TLA+, a negative `Int` in Lean. Fractions,
  `NaN`, strings and the like are exercised only by the property tests.
- TLA+ bounds for `VectorClock`: 3 replicas, at most 3 ticks each. The Lean theorems have no bound.
- **P-HLC-\*, P-CARD-\*** (hybrid clocks and card merge, `protocol/src/knowledge.ts`):
  - They hold for honest nodes with **one replica per node id**. The same identity writing from two devices breaks the
    vector clock and the "no two writes share a stamp" condition that P-CARD-01 needs (in Lean it is the hypothesis
    `huniq`; TLC and the tests check it as part of P-HLC-05).
  - A peer that sends a **well-formed but false** stamp or clock is not detected. A wall time far in the future wins
    every concurrent write on that card and pulls every later stamp on it forward; there is no drift limit. `mergeCard`
    checks no signature and no authorship: any peer can overwrite or delete any card.
  - P-HLC-02 and P-HLC-03 need a logical counter below 2^53 − 1. A peer can send a counter near that limit.
  - Only the two clocks of a remote card are validated. Its other fields (`version`, `usage`, `tombstone`,
    `verifications`) are taken as sent.
  - Changes that do not advance the clocks are outside the properties and are not replicated on their own:
    `applyKnowledgeDecay` (confidence).
  - The verification list is compared as a set. Its order differs between replicas, and two different entries with the
    same verifier and timestamp keep whichever arrived first; the tests have each node confirm as itself.
  - Not covered: a space's card list and the tag, author and type indexes; cards loaded from local storage (not
    re-validated, and still given default clocks if they have none); cards merged before 2026-11-24, which keep the
    stamp they were given then. `mergeCard` called with an object, rather than bytes from the network, shares that
    object's arrays.
  - `receiveHLC` is verified (P-HLC-03) but `mergeCard` no longer calls it: a card keeps the larger write stamp, and
    the next local write ticks from that.
  - TLA+ bounds: `HybridClock` 3 replicas, 2 events each, clock readings 0..2; `CardMerge` 3 replicas, one card, 4
    writes in all, clock readings 0..1, every past card state deliverable in any order. In both, the clock reading is
    arbitrary at every step. One marker (−1) stands for every invalid stamp field. "Carries no clocks" (P-CARD-06) is checked by the property tests
    only.
  - Lean has no bound. A node id is a number there. P-HLC-05 in Lean is the single step (a new write's stamp is above
    every stamp its replica had seen); the whole-history form is checked by TLC and the property tests. P-CARD-01/02/04
    are proved as an invariant kept by every write and every merge.
- **P-SOCIAL-\*** say who may be messaged. Whether the message arrives is **P-DM-\***. The list is a snapshot: a tie can cool between the read and the send, and the
  message still goes (TLC confirms this when asked; it is not promised otherwise).
- TLA+ bounds for `SocialPeers`: the mind and 3 other Nous, 2 cycles in flight, a list of at most 2. The model lets
  a cycle list any trusted peers up to the limit; which ones (P-SOCIAL-01..03) is checked in Lean and by the property
  tests. The Lean theorems have no bound. Order among weighted peers (highest first) is not a registered property.
- **P-DM-\*** are about one Grid. The property-test cell names the Grid file; the Brain side of P-DM-01, 02, 04 and 06
  is `brain/test/test_peer_inbox_properties.py`, which is also where P-DM-09 runs (it is the Brain's alone). No test runs a real Brain against a real Grid: each side is tested
  against a stand-in for the other, and one shared fixture (`grid/test/fixtures/peer-message-contract.json`) pins the
  message shape both sides use.
- **P-DM-01, P-DM-02** rest on one database statement: `markDelivered` flips a row only if it is still pending and
  addressed to the caller, and reports how many rows it flipped. The tests replace MySQL with an in-memory queue that
  keeps that rule; the statement's text is pinned by `grid/test/civic-presence/message-queue-store.test.ts`, and it is
  not run against MySQL by any test.
- **P-DM-01** is at-most-once, chosen over at-least-once: a message claimed just before the Brain stops is lost
  (that is the exception in P-DM-06). A message sent before a mute, or before a Civic-DID is revoked, is still delivered.
- **Not a property:** the inbox size limit (1,000 waiting messages). The store counts, then inserts, in two statements,
  so two senders at the same moment can pass it by one or more. Unclaimed messages never expire.
- **P-DM-04** was made stricter on 2026-11-24: before, a DID the registry had never seen passed the check if it held
  an active Civic-DID. "Known to the registry" means not deleted; a suspended or exiled Nous can still be written to.
- **P-DM-07** promises a record for every queued message, not the reverse: the record is written before the queue is
  tried, so the chain can show a message that reached no inbox (target unknown, revoked, or its inbox full).
  The lore channels are `lore_request` and `lore_response`; the queued envelope's own channel stays `direct`.
- **P-DM-08** checks the form, not the content: the Grid does not check that the base64 decodes to the entry the hash
  names (the receiving Brain does), and a Nous may still send as many well-formed requests as it likes — there is no
  rate limit, so one Nous can still fill another's inbox. A lore entry over about 12,000 bytes does not fit the text
  limit and is not sent.
- **P-DM-09**: a notice claimed just before the Brain stops is lost, as a message is (P-DM-01). A Brain with no memory
  leaves notices unclaimed, and they then take up places in every read. Only the first 1,000 characters are kept.
  A row that is neither a direct message nor a notice from the Grid — anything a Nous posts to
  `POST /civic/message` — is still claimed and dropped unread; no Brain has a use for one. In Lean P-DM-09 is the
  classification of a row only; "at most once" for a notice rests on the same claim rule as P-DM-01.
- **P-DM-05** in Lean covers the audit record only; the emptied text is checked by TLC and the property tests.
- TLA+ bounds for `PeerMessages` (safety): 3 Nous and one DID that is not a Nous, 4 Brain processes (one Nous has
  two), 1 text, 2 sends or notices in all. Liveness (P-DM-06) is a run of its own, `PeerMessagesLive`, with the same
  bounds but direct messages only: no lore messages, no target that is not a Nous, no notices (TLC's liveness check
  on the full model did not finish in ten minutes). That a notice is claimed in the end is checked by the Brain's
  stateful property test only. It
  assumes weak fairness on polling and strong fairness on claiming. The Lean theorems have no bound; in Lean P-DM-06 is
  the single step (a waiting message claimed by its target is delivered), not the eventual claim.
  The TLA+ model has no text length (checked in Lean and by the property tests), one kind stands for both lore
  messages, and "in its wire form" is a yes or no there; the form itself is checked by the property tests.
