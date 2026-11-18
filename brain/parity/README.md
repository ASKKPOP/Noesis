# Brain parity fixtures

Step R0 of the Rust Brain port (D-V3-42): the contract freeze.

`fixtures/*.json` record what the Python Brain's deterministic faculties compute. They
are language-neutral. A Rust module is correct when it reproduces every case exactly.

| File | Contract it freezes |
|------|---------------------|
| `bios.json` | need constants, hysteresis bucketing, three 8,000-tick need trajectories (values, levels, every crossing, starvation) |
| `ananke.json` | drive constants, bucketing, three 8,000-tick drive trajectories; pins that the update is seed-independent |
| `chronos.json` | subjective-time multiplier table, tick-based recency and its scaled score |
| `hashing.json` | active-Telos hash; canonical-JSON SHA-256 (sorted keys, no whitespace, raw UTF-8) |
| `thymos.json` | emotion feel / decay / trigger matching at low, medium and high intensity |

## Rules

- Replay: `.venv/bin/pytest test/test_parity_fixtures.py` (part of the normal Brain suite).
- Re-record: `.venv/bin/python -m scripts.record_parity_fixtures`. This is a contract
  change — only when the Python behaviour changed on purpose; review the diff.
- Numbers are IEEE-754 doubles written in shortest round-trip decimal form. Compare
  parsed values, not text — except `canonical_json`, where the text itself is hashed.

## Known porting hazards these fixtures expose

- `decay_factor` is `exp(-1/500)` computed once. A port must produce the same double;
  if the platform `exp` differs in the last bit, embed the recorded constant.
- Canonical JSON uses Python's float text: `1e-07`, `1e+21`, `2.0`, `-0.0`. Rust's
  default formatting (`1e-7`, `1e21`) hashes differently — see the `floats` case.
- Non-ASCII is hashed as raw UTF-8, not `\u` escapes.
- Trigger matching lower-cases with Python's `str.lower()`.

## Not covered yet

The LLM loops (planner, decision, reflection), prompt rendering, tolerant JSON parsing,
the RPC and wire surface, memory storage and retrieval, and P2P. Those need recorded
request/response fixtures and are the R3–R4 part of the freeze.
