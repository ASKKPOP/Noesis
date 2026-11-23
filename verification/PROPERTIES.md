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
| P-SOCIAL-01 | A trusted peer is another Nous whose tie is hot or warm, or whose known weight is at least 0.3: never a cold or unknown one, never the mind itself. | N/A (V-9.2) pure function, no state between calls | verification/lean/Verification/SocialPeers.lean | brain/test/test_social_peers_properties.py |
| P-SOCIAL-02 | The trusted-peer list has at most three entries and none twice. | N/A (V-9.2) pure function, no state between calls | verification/lean/Verification/SocialPeers.lean | brain/test/test_social_peers_properties.py |
| P-SOCIAL-03 | A peer from a later source (weight, then hot, then warm) is listed only if every peer from the earlier sources is listed. | N/A (V-9.2) pure function, no state between calls | verification/lean/Verification/SocialPeers.lean | brain/test/test_social_peers_properties.py |
| P-SOCIAL-04 | Whatever DID the model names, the social cycle queues a message or a taught skill only to a peer on the list it built in that same cycle. | verification/tla/SocialPeers.tla | verification/lean/Verification/SocialPeers.lean | brain/test/test_social_peers_properties.py |

## Stated limits

- **P-VCLOCK-\*** hold for counts that are natural numbers. `mergeVectorClocks` does not validate counts; a
  negative, fractional or `NaN` count from a remote peer is outside these properties and is not rejected today.
- TLA+ bounds for `VectorClock`: 3 replicas, at most 3 ticks each. The Lean theorems have no bound.
- **P-SOCIAL-\*** say who may be messaged. They do not say the message arrives: the Grid records a direct message
  and delivers it to no one today. The list is a snapshot: a tie can cool between the read and the send, and the
  message still goes (TLC confirms this when asked; it is not promised otherwise).
- TLA+ bounds for `SocialPeers`: the mind and 3 other Nous, 2 cycles in flight, a list of at most 2. The model lets
  a cycle list any trusted peers up to the limit; which ones (P-SOCIAL-01..03) is checked in Lean and by the property
  tests. The Lean theorems have no bound. Order among weighted peers (highest first) is not a registered property.
