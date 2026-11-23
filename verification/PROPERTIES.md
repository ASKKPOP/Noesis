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

## Stated limits

- **P-VCLOCK-\*** hold for counts that are natural numbers. `mergeVectorClocks` does not validate counts; a
  negative, fractional or `NaN` count from a remote peer is outside these properties and is not rejected today.
- TLA+ bounds for `VectorClock`: 3 replicas, at most 3 ticks each. The Lean theorems have no bound.
