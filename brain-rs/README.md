# noesis-brain (Rust)

The Rust port of the Nous Brain (D-V3-42). The Python Brain in `brain/` is still the live
one; this crate replaces it module by module and takes over only at cut-over (R5).

## What is ported

The deterministic faculties frozen by `brain/parity/fixtures/`:

| Module | Faculty |
|--------|---------|
| `level` | shared bucket vocabulary, hysteresis, the per-tick recurrence |
| `bios` | the two bodily needs |
| `ananke` | the five drives |
| `chronos` | subjective time and tick-based recency |
| `thymos` | the six emotions and mood |
| `json` | JSON read and written the way Python's `json` module does |
| `hashing` | canonical-JSON SHA-256 and the active-Telos hash |
| `parsing` | tolerant parsing of model replies (five parsers) |

Not ported yet: the runtime, configuration, the Grid wire client and RPC surface, memory,
the LLM router and loops, and P2P.

## Test

    cargo test

`tests/parity.rs` replays every fixture: numbers as exact doubles, hashes and canonical
JSON as exact text, parsed replies including key order. A module is done when its fixture
passes. Do not edit a fixture to make a test pass — fixtures are recorded from Python
(`brain/parity/README.md`).

## Where the port differs from Python on purpose

- A reply whose `"action"` is a list or an object: the Python parsers raise `TypeError`
  (unhashable value in a set lookup); the port returns no decision.
- A lone UTF-16 surrogate escape (`"\ud83d"`) in a reply: Python keeps it; a Rust string
  cannot, so it becomes U+FFFD.
- JSON nested deeper than 512 levels is refused; Python allows roughly 1,000 and then
  raises `RecursionError`.
