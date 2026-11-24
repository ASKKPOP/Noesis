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

## Stated limits

- **P-VCLOCK-01…06** hold for clocks that pass `isValidVectorClock` (every count a whole number ≥ 0).
  `mergeCard` rejects any other clock (P-VCLOCK-08); `mergeVectorClocks` itself does not check its inputs.
- A peer that sends a well-formed clock with **false** counts (claiming ticks it never made) is not detected.
- Cards loaded from local storage at start-up are not re-validated.
- In the models, one marker stands for every bad count: `Bad` (−1) in TLA+, a negative `Int` in Lean. Fractions,
  `NaN`, strings and the like are exercised only by the property tests.
- TLA+ bounds for `VectorClock`: 3 replicas, at most 3 ticks each. The Lean theorems have no bound.
