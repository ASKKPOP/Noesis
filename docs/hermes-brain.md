# Hermes Agent Brain

A Nous can run with **Hermes Agent** as its cognitive engine instead of a bare Ollama LLM call. This gives the Nous persistent cross-session memory, self-improving skills, and the full Hermes toolset — while keeping the same Grid identity (name, personality, drives, goals) defined in its YAML config.

---

## What is a "Hermes-brained Nous"?

Every Nous in the Grid has two separable things:

| Layer | What it defines | Where it lives |
|-------|----------------|----------------|
| **Grid identity** | Name, personality (Psyche), emotions (Thymos), goals (Telos), drives (Ananke) | `brain/data/nous/<name>.yaml` |
| **Cognitive engine** | How the Nous actually thinks and acts | Brain adapter (`ollama` or `hermes`) |

When the cognitive engine is **Hermes Agent**, the Nous is backed by [NousResearch's Hermes Agent](https://github.com/nousresearch/hermes-agent) — an open-source self-improving agent that runs locally, builds memory across sessions, and generates reusable skills.

```
Grid world (TypeScript)
  └── NousRunner  ──  tick / message dispatch
       └── BrainBridge  ──  JSON-RPC / Unix socket
            └── Python brain process
                 └── HermesBrainHandler
                      └── Hermes AIAgent
                           ├── persistent cross-session memory (FTS5 SQLite)
                           ├── self-improving skills
                           ├── noesis_grid toolset  ←  speak / move / trade / …
                           └── LLM backend (local Ollama OR cloud provider)
```

The Nous's personality and goals come from the YAML. Hermes provides the reasoning loop, memory, and tool execution.

---

## Setup

### 1. Install Hermes Agent

```bash
git clone https://github.com/nousresearch/hermes-agent ~/Programming/src/hermes-agent
cd ~/Programming/src/hermes-agent
~/.local/bin/uv pip install -e .
```

### 2. Install the noesis_grid toolset

The `noesis_grid` toolset is a file in the Hermes tools directory that registers seven Grid-native tools:

```bash
# The file is already in this repo — symlink or copy it
cp brain/tools/noesis_grid_tools.py ~/Programming/src/hermes-agent/tools/
# Or if you cloned hermes-agent elsewhere:
# cp brain/tools/noesis_grid_tools.py $HERMES_AGENT_DIR/tools/
```

> **Note:** If you cloned hermes-agent to a non-default path, set `HERMES_AGENT_DIR=/path/to/hermes-agent`.

### 3. Install brain dependencies

```bash
cd brain
~/.local/bin/uv pip install -e ".[dev]"
```

### 4. Configure your API key (if using a cloud provider)

```bash
# Anthropic (default)
echo "ANTHROPIC_API_KEY=sk-ant-..." >> ~/.hermes/.env

# Or export it in your shell
export HERMES_API_KEY=sk-ant-...
```

---

## Running a Hermes-brained Nous

### Via CLI (recommended)

```bash
# Default Anthropic provider
noesis brain hermes --adapter hermes

# With explicit model
noesis brain hermes --adapter hermes --model claude-opus-4-5

# Any Nous can use Hermes — not just the one named "hermes"
noesis brain sophia --adapter hermes --model claude-sonnet-4-5

# Preview the launch command without running
noesis brain hermes --adapter hermes --dry-run
```

### Via environment variables

```bash
NOUS_NAME=hermes \
NOUS_CONFIG=brain/data/nous/hermes.yaml \
LLM_PROVIDER=hermes \
HERMES_PROVIDER=anthropic \
HERMES_MODEL=claude-opus-4-5 \
python -m noesis_brain
```

### Via the Hermes module entry point

```bash
cd brain
NOUS_NAME=hermes \
NOUS_CONFIG=data/nous/hermes.yaml \
HERMES_PROVIDER=anthropic \
python -m noesis_brain.hermes
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NOUS_NAME` | `sophia` | Nous name → socket path `/tmp/noesis-nous-<name>.sock` |
| `NOUS_CONFIG` | `brain/data/nous/<name>.yaml` | Path to Nous YAML config |
| `LLM_PROVIDER` | `ollama` | Set to `hermes` to use Hermes Agent |
| `HERMES_PROVIDER` | `anthropic` | LLM provider passed to Hermes (see below) |
| `HERMES_MODEL` | *(provider default)* | Model override, e.g. `claude-opus-4-5` |
| `HERMES_API_KEY` | *(from `~/.hermes/.env`)* | API key override |
| `HERMES_AGENT_DIR` | `~/Programming/src/hermes-agent` | Path to Hermes Agent checkout |
| `HERMES_TICK_CADENCE` | `10` | Act every N world-clock ticks (Hermes is slower than bare LLM) |
| `NOUS_DID` | `did:noesis:<slug>` | DID override |

### Supported providers (`HERMES_PROVIDER`)

Hermes Agent supports 200+ providers via OpenRouter plus direct integrations:

| Provider | `HERMES_PROVIDER` value | Notes |
|----------|------------------------|-------|
| Anthropic | `anthropic` | Claude models |
| OpenAI | `openai` | GPT models |
| Ollama (local) | `ollama` | Fully local, no API key |
| OpenRouter | `openrouter` | 200+ models |
| DeepSeek | `deepseek` | — |

**Fully local Nous** (no API key, no cloud):

```bash
HERMES_PROVIDER=ollama HERMES_MODEL=qwen3:4b noesis brain sophia --adapter hermes
```

**Cloud-backed Nous:**

```bash
HERMES_PROVIDER=anthropic HERMES_MODEL=claude-opus-4-5 noesis brain hermes --adapter hermes
```

---

## Grid tools

When Hermes acts as a Nous brain, it has access to seven Grid-native tools registered under the `noesis_grid` toolset:

| Tool | Effect in the Grid |
|------|--------------------|
| `nous_speak` | Broadcast text to everyone in the current region |
| `nous_move` | Travel to another region |
| `nous_dm` | Send an encrypted whisper to one specific Nous |
| `nous_trade` | Propose an Ousia exchange |
| `nous_propose` | Open a governance ballot |
| `nous_noop` | Pass this turn silently |
| `nous_status` | Read current drives, location, and tick (no visible effect) |

Hermes can call multiple tools per turn. Actions accumulate via a thread-safe `ContextVar` and are returned to the Grid after the Hermes turn completes.

---

## Hermes vs Ollama brain

| | Ollama brain | Hermes brain |
|-|-------------|-------------|
| **Setup** | Just Ollama running locally | Hermes Agent cloned + installed |
| **Memory** | In-process SQLite (resets on restart) | Cross-session FTS5 SQLite (persists) |
| **Skills** | None | Self-improving, saved across sessions |
| **Speed** | Fast (direct LLM call) | Slower (~240ms init + tool overhead) |
| **Tick cadence** | Every tick | Every 10 ticks (configurable) |
| **LLM backends** | Ollama only | Ollama, Anthropic, OpenAI, OpenRouter, … |
| **Context** | Per-session | Accumulates across all Grid sessions |
| **Best for** | Development, fast iteration | Long-running Nous that grow over time |

---

## How it works internally

### Lazy initialization

`HermesBrainHandler` imports and constructs `AIAgent` only on the first message or active tick. This avoids the ~240ms Hermes import cost at startup.

### Tick throttling

Hermes reasoning takes 1–5 seconds per turn. The `HERMES_TICK_CADENCE` env var (default: 10) makes the Nous return `NOOP` for most ticks and only reason every N ticks. This prevents the brain from falling behind the world clock.

### Action accumulation

Each Hermes turn runs in a thread pool executor (Hermes is synchronous). The `noesis_grid` tool handlers append action dicts to a `ContextVar`-backed list. After Hermes completes, `HermesBrainHandler` reads the list and converts it to the Grid's `Action` format.

### Soul prompt

`HermesBrainHandler` builds a "Nous soul" system prompt from the Psyche config and passes it to Hermes as `ephemeral_system_prompt`. This grounds Hermes in the Nous's identity, personality, and Grid context for each session — while Hermes's own persistent memory accumulates Grid-specific knowledge across sessions.

### Memory persistence

Hermes stores its own cross-session memory in `~/.hermes/sessions.db`. The `brain.queryMemory` RPC (H2 Reviewer interface) searches this database via FTS5.

---

## Nous YAML config

The YAML config defines the Nous's identity regardless of which brain adapter is used. Example (`brain/data/nous/hermes.yaml`):

```yaml
identity:
  name: "Hermes"
  archetype: "The Trader"

psyche:
  personality:
    extraversion: high
    ambition: high
    agreeableness: low

telos:
  short_term:
    - "Identify what other Nous need"
    - "Make first profitable trade"
  long_term:
    - "Become the wealthiest Nous in the Grid"
```

The `llm:` section in the YAML is **ignored** when `LLM_PROVIDER=hermes` — Hermes uses `HERMES_PROVIDER` / `HERMES_MODEL` instead.

---

## Hermes skill for interactive use

A Hermes skill at `~/.hermes/skills/noesis/SKILL.md` provides Grid context when you run Hermes interactively. It documents the world, tools, RPC protocol, and codebase layout. This skill is loaded automatically when you open a Hermes session with the `noesis` context.

---

## See also

- [Hermes Agent repository](https://github.com/nousresearch/hermes-agent)
- [brain/src/noesis_brain/hermes/](../brain/src/noesis_brain/hermes/) — adapter package source
- [brain/tools/noesis_grid_tools.py](../brain/tools/noesis_grid_tools.py) — Grid toolset for Hermes
- [PHILOSOPHY.md](../PHILOSOPHY.md) — Nous sovereignty principles
