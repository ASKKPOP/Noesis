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
| P-SOCIAL-01 | A trusted peer is another Nous whose tie is hot or warm, or whose known weight is at least 0.3: never a cold or unknown one, never the mind itself. | N/A (V-9.2) pure function, no state between calls | verification/lean/Verification/SocialPeers.lean | brain/test/test_social_peers_properties.py |
| P-SOCIAL-02 | The trusted-peer list has at most three entries and none twice. | N/A (V-9.2) pure function, no state between calls | verification/lean/Verification/SocialPeers.lean | brain/test/test_social_peers_properties.py |
| P-SOCIAL-03 | A peer from a later source (weight, then hot, then warm) is listed only if every peer from the earlier sources is listed. | N/A (V-9.2) pure function, no state between calls | verification/lean/Verification/SocialPeers.lean | brain/test/test_social_peers_properties.py |
| P-SOCIAL-04 | Whatever DID the model names, the social cycle queues a message or a taught skill only to a peer on the list it built in that same cycle. | verification/tla/SocialPeers.tla | verification/lean/Verification/SocialPeers.lean | brain/test/test_social_peers_properties.py |
| P-DM-01 | A direct message is handed to the target Brain's `on_message` at most once, however often it is polled, however many Brain processes poll for that Nous, and across restarts. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-02 | A direct message is shown to, and handed to, only the Brain of the Nous it was addressed to. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-03 | Nothing a Nous sends while it is muted — a direct message, a lore request or a lore response — is queued for anyone. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-04 | A message is queued only for another Nous, only when sender and target both hold an active Civic-DID and are not deleted, and only with a text of 1 to 16,384 characters; a Brain accepts from its inbox only a well-formed direct message from another Nous. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-05 | The audit record of a direct message is the target, the channel and the tick, never the text; the Grid's copy of the text is emptied when the message is claimed. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-DM-06 | A queued message is handed over in the end, as long as the target's Brain keeps polling and is not stopped between claiming a message and handling it. | verification/tla/PeerMessages.tla | verification/lean/Verification/PeerMessages.lean | grid/test/integration/peer-messages.property.test.ts |
| P-SKILLTRUST-01 | A Brain trusts a peer to teach it a skill only if it holds a relationship weight of at least 0.35 for that peer, or the Grid's latest answer lists that peer as a hot tie: never a warm, cold or unlisted peer, never the mind itself, never on a weight that is not a finite number. | verification/tla/SkillTrust.tla | verification/lean/Verification/SkillTrust.lean | brain/test/test_skill_trust_properties.py |
| P-SKILLTRUST-02 | A ties read that fails, or answers with something that is not a list of ties, leaves nobody trusted as a hot tie; the earlier answer is not kept. | verification/tla/SkillTrust.tla | verification/lean/Verification/SkillTrust.lean | brain/test/test_skill_trust_properties.py |
| P-SKILLTRUST-03 | A taught skill is quarantined only if its teacher was trusted when it arrived, and joins the skills only if the teacher is trusted again when the quarantine ends; otherwise it is thrown away. | verification/tla/SkillTrust.tla | verification/lean/Verification/SkillTrust.lean | brain/test/test_skill_trust_properties.py |

## Stated limits

- **P-VCLOCK-01…06** hold for clocks that pass `isValidVectorClock` (every count a whole number ≥ 0).
  `mergeCard` rejects any other clock (P-VCLOCK-08); `mergeVectorClocks` itself does not check its inputs.
- A peer that sends a well-formed clock with **false** counts (claiming ticks it never made) is not detected.
- Cards loaded from local storage at start-up are not re-validated.
- In the models, one marker stands for every bad count: `Bad` (−1) in TLA+, a negative `Int` in Lean. Fractions,
  `NaN`, strings and the like are exercised only by the property tests.
- TLA+ bounds for `VectorClock`: 3 replicas, at most 3 ticks each. The Lean theorems have no bound.
- **P-SOCIAL-\*** say who may be messaged. Whether the message arrives is **P-DM-\***. The list is a snapshot: a tie can cool between the read and the send, and the
  message still goes (TLC confirms this when asked; it is not promised otherwise).
- TLA+ bounds for `SocialPeers`: the mind and 3 other Nous, 2 cycles in flight, a list of at most 2. The model lets
  a cycle list any trusted peers up to the limit; which ones (P-SOCIAL-01..03) is checked in Lean and by the property
  tests. The Lean theorems have no bound. Order among weighted peers (highest first) is not a registered property.
- **P-DM-\*** are about one Grid. The property-test cell names the Grid file; the Brain side of P-DM-01, 02, 04 and 06
  is `brain/test/test_peer_inbox_properties.py`. No test runs a real Brain against a real Grid: each side is tested
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
- **P-DM-05** in Lean covers the audit record only; the emptied text is checked by TLC and the property tests.
- TLA+ bounds for `PeerMessages`: 3 Nous, 4 Brain processes (one Nous has two), 1 text, 2 sends. Liveness (P-DM-06)
  assumes weak fairness on polling and strong fairness on claiming. The Lean theorems have no bound; in Lean P-DM-06 is
  the single step (a waiting message claimed by its target is delivered), not the eventual claim.
  The TLA+ model has no text length and no lore request or response; those are checked in Lean (length) and by the
  property tests (both).
- **P-SKILLTRUST-\*** are about the Brain's last read of its ties, not the tie at that instant. The Brain reads its ties
  before it handles a taught skill, in the tick before a quarantined skill is due, and at least every 60 ticks. A tie
  can cool after the read and before the sweep (one tick apart when the Brain keeps up), and the skill still joins.
  A hot tie is taken from the Grid's public answer as given: the Brain does not check that the answer is true.
- **P-SKILLTRUST-\*** change nothing while a live Brain has no skill store (the entry point never passes
  `hypnos_db_dir`): the gate is then never reached and a taught skill is dropped. The tests build the store themselves.
- The flood cap (3 skills per teacher) and the injection scan are older gates and are not registered properties; the
  stateful property test models the cap so that its expectations are exact.
- TLA+ bounds for `SkillTrust`: 2 peers, 3 taught skills, no held weights (the live-wired case). Held weights are in
  Lean and the property tests. The Lean theorems have no bound and use whole hundredths for weights; they also show
  why the rule is hot and not warm (`hot_bucket_reaches_threshold`, `warm_bucket_can_miss_threshold`).
