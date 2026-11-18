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
| `psyche` | personality dimensions, values, their prompt descriptions |
| `state_hash` | the four component hashes of a Nous's state |
| `memory` | retrieval scoring (recency × importance × relevance) and top-k ranking |
| `prompts` | the planning, decision, skill, social and economic prompts |
| `telos` | goals: priorities, progress, time-based evolution, the goals block |
| `system_prompt` | the full system prompt, every section |
| `pytext` | Python's whitespace and `str()` rules, where they change a result |

Not ported yet: the goal ledger (task queue), the runtime, configuration, the Grid wire client and RPC
surface, memory storage, the LLM router and loops, and P2P.

## Test

    cargo test

`tests/parity.rs` replays every fixture: numbers as exact doubles, hashes and canonical
JSON as exact text, parsed replies including key order. A module is done when its fixture
passes. Do not edit a fixture to make a test pass — fixtures are recorded from Python
(`brain/parity/README.md`).

## Where the port differs from Python on purpose

- A prompt value that is a list or an object (never the case for the ids and amounts the
  prompts interpolate) is written as JSON, not as Python's `repr`.
- A Grid feed with the wrong shape (a non-object where an object belongs, e.g. a text
  `environment` or a text `outstanding_due`) is skipped; the Python prompt builder raises.
- A lone UTF-16 surrogate escape (`"\ud83d"`) in a reply: Python keeps it; a Rust string
  cannot, so it becomes U+FFFD.
- JSON nested deeper than 512 levels is refused; Python allows roughly 1,000 and then
  raises `RecursionError`.
