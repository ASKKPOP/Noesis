# Research: Communication Protocols for Agent-to-Agent Interaction

## 1. A2A Protocol (Google/Linux Foundation)

**Status**: Production-ready, v1.0.0 (March 2026). Apache 2.0 license. 23.2k GitHub stars.
**Repository**: github.com/a2aproject/A2A

### Architecture

A2A defines 11 RPC operations across three transport bindings (JSON-RPC 2.0, gRPC, HTTP+REST). Agents must implement at least one.

### Core Data Model

**Task** — stateful work unit:
```
Task {
  id: string                    // unique identifier
  contextId: string             // groups related tasks  
  status: TaskStatus            // current state
  history: Message[]            // message exchange record
  artifacts: Artifact[]         // generated outputs
  createdTime: ISO 8601
  updatedTime: ISO 8601
  metadata: object
}
```

**TaskState** enum:
- SUBMITTED (1) — submitted, not yet processing
- WORKING (2) — actively processing
- COMPLETED (3) — success (terminal)
- FAILED (4) — error (terminal)
- CANCELED (5) — canceled (terminal)
- INPUT_REQUIRED (6) — waiting for user input
- REJECTED (7) — agent rejected (terminal)
- AUTH_REQUIRED (8) — authorization needed mid-task

**Message**:
```
Message {
  message_id: string
  role: USER | AGENT
  parts: Part[]               // TextPart, FilePart, DataPart
  metadata: Struct
  extensions: string[]
  reference_task_ids: string[]
}
```

**Part** (oneof content):
- `text` — plain text (UTF-8)
- `raw` — binary (base64 in JSON)
- `url` — URI reference to file
- `data` — structured JSON (google.protobuf.Value)

Each Part also carries optional `filename`, `media_type`, `metadata`.

**Artifact** — named output grouping Parts:
```
Artifact {
  artifact_id: string
  name: string
  description: string
  parts: Part[]
  metadata: Struct
}
```

### RPC Methods

| Method | Purpose |
|--------|---------|
| SendMessage | Send message, get single response |
| SendStreamingMessage | Send message with SSE/gRPC streaming |
| GetTask | Retrieve task status/history |
| ListTasks | Query tasks (paginated, filtered) |
| CancelTask | Cancel a running task |
| SubscribeToTask | Resume streaming for existing task |
| CreateTaskPushNotificationConfig | Set webhook for async updates |
| GetTaskPushNotificationConfig | Get webhook config |
| ListTaskPushNotificationConfigs | List all webhook configs for task |
| DeleteTaskPushNotificationConfig | Remove webhook |
| GetExtendedAgentCard | Fetch detailed card (authenticated) |

### Agent Card

Served at `/.well-known/agent-card.json` (RFC 8615):
```
AgentCard {
  name: string (REQUIRED)
  description: string (REQUIRED)
  version: string (REQUIRED)
  supported_interfaces: AgentInterface[] (REQUIRED)
  capabilities: AgentCapabilities (REQUIRED)
  default_input_modes: string[] (REQUIRED)
  default_output_modes: string[] (REQUIRED)
  skills: AgentSkill[] (REQUIRED)
  security_schemes: map<string, SecurityScheme>
  provider: AgentProvider
  signatures: AgentCardSignature[]
}
```

**AgentSkill**:
```
AgentSkill {
  id: string
  name: string
  description: string
  tags: string[]
  examples: string[]
  input_modes: string[]
  output_modes: string[]
}
```

### Streaming (SSE)

JSON-RPC streaming returns `Content-Type: text/event-stream`. Events:
- `TaskStatusUpdateEvent` — state change with timestamp
- `TaskArtifactUpdateEvent` — artifact delivery (supports `append` and `last_chunk` for incremental delivery)

### Authentication

Five schemes: APIKey, HTTP (Bearer/Basic), OAuth2 (auth code, client credentials, device code), OpenID Connect, Mutual TLS.

Mid-task auth: Task transitions to AUTH_REQUIRED, client provides credentials, task resumes.

### Push Notifications

Webhook-based async updates. Client registers a URL + auth credentials. Server POSTs `StreamResponse` objects to webhook on state/artifact changes. Retry with exponential backoff. HMAC-SHA256 signatures for authenticity.

### Error Codes

| Error | HTTP | gRPC | JSON-RPC |
|-------|------|------|----------|
| TaskNotFound | 404 | NOT_FOUND | -32001 |
| TaskNotCancelable | 409 | FAILED_PRECONDITION | -32002 |
| PushNotSupported | 501 | UNIMPLEMENTED | -32003 |
| UnsupportedOperation | 501 | UNIMPLEMENTED | -32004 |
| ContentTypeNotSupported | 415 | INVALID_ARGUMENT | -32005 |

### Official SDKs

| Language | Package | Install |
|----------|---------|---------|
| Python | a2a-sdk | `pip install a2a-sdk` |
| JavaScript | @a2a-js/sdk | `npm install @a2a-js/sdk` |
| Go | a2a-go | `go get github.com/a2aproject/a2a-go` |
| Java | a2a-java | Maven |
| .NET | A2A | NuGet |

### Framework Integrations

- **Google ADK**: Native A2A support
- **Pydantic AI**: FastA2A server framework
- **LangChain**: A2A endpoint support
- **Amazon Bedrock AgentCore**: A2A with AWS auth
- **Microsoft Agent Framework**: A2A 1.0 announced

### Limitations for Noēsis

1. **No machine-readable skill schemas** — Skills use freetext description, no JSON Schema for parameters
2. **Weak determinism** — Client sends natural language, server decides which skill to invoke
3. **Point-to-point** — No pub/sub, no message broker; connections grow O(N²)
4. **No shared state** — Explicitly stateless between agents (by design)
5. **No orchestration** — No workflow engine, DAG execution, or routing
6. **No observability** — No correlation IDs, no OpenTelemetry integration
7. **Agent Card signatures optional** — Impersonation risk without enforcement

---

## 2. ANP (Agent Network Protocol)

**Status**: Active development. Chinese AI community origin. Open source.
**Repository**: github.com/agent-network-protocol/AgentNetworkProtocol

### Three-Layer Architecture

```
Layer 3: Application Protocol
  └── Agent Description (JSON-LD + schema.org)
  └── Agent Discovery (.well-known endpoints)
  └── E2E Messaging (Double Ratchet)

Layer 2: Meta-Protocol
  └── Natural language protocol negotiation
  └── AI-assisted code generation for protocol handlers
  └── Cached negotiation results (0RTT optimization)

Layer 1: Identity & Encrypted Communication
  └── W3C DID (did:wba method)
  └── ECDHE end-to-end encryption
  └── HTTP Message Signatures (RFC 9421)
```

### Identity: did:wba Method

Custom DID method extending did:web for AI agents:
```
did:wba:{domain}:{path}:{e1_fingerprint}
```

The `e1_` fingerprint embeds the Ed25519 public key directly in the DID:
1. Convert Ed25519 publicKeyMultibase to JWK (only crv, kty, x)
2. Create RFC 7638 JWK thumbprint (sorted JSON)
3. SHA-256 hash → base64url encode (43 chars)
4. Prepend `e1_`

**Authentication flow**:
1. Client sends DID + HTTP Message Signature (RFC 9421)
2. Server fetches DID document from DID's HTTPS endpoint
3. Server verifies signature against DID document's verification method
4. Server returns auth token for subsequent requests

**Key management**: Hierarchical separation — ordinary keys vs. `humanAuthorization` keys requiring biometric/hardware confirmation for high-risk operations.

### Agent Description (JSON-LD)

```json
{
  "protocolType": "ANP",
  "type": "AgentDescription",
  "name": "...",
  "did": "did:wba:...",
  "description": "...",
  "interfaces": [
    {
      "type": "NaturalLanguageInterface|StructuredInterface",
      "protocol": "YAML|openrpc|MCP|WebRTC",
      "url": "..."
    }
  ],
  "proof": { /* W3C Data Integrity Proof */ }
}
```

### Discovery

**Active**: `GET /.well-known/agent-descriptions` returns JSON-LD CollectionPage with paginated agent list.

**Passive**: Agents register with search service APIs (like web search engine crawling).

NOT DHT-based — uses web-native HTTP endpoints.

### Meta-Protocol Negotiation

Six-phase workflow:
1. Agent A sends candidate protocols (natural language + JSON)
2. Agent B proposes alternatives or accepts
3. Both generate protocol handler code (AI-assisted)
4. Joint testing with test cases
5. Formal communication begins
6. Re-negotiation on requirement changes

**0RTT optimization**: Cache negotiated protocols with content hash. Subsequent connections reuse cached protocols.

### SDK

**AgentConnect** (Python): `pip install anp`
- Decorator-driven agent framework
- Auto-generates: `GET /agent/ad.json`, `GET /agent/interface.json`, `POST /agent/rpc`
- RFC 9421 HTTP Message Signatures for auth
- LLM-agnostic (can convert interfaces to OpenAI Tools format)

### Key Differentiator from A2A

A2A delegates execution to remote agents (task-based). ANP keeps decision-making local — the requesting agent acquires information and decides locally. Fundamental privacy difference.

---

## 3. AID (Agent Identity and Discovery)

**Status**: IETF draft (draft-nemethi-aid-agent-identity-discovery-00)
**Evolved from**: ACDP (CmdZero)

### DNS TXT Record Format

At `_agent.<domain>`:
```
v=aid1;u=https://api.example.com/mcp;p=mcp;a=pat;s=Example AI Tools
```

| Key | Required | Purpose |
|-----|----------|---------|
| v (version) | Yes | Must be "aid1" |
| u (uri) | Yes | Agent endpoint URL |
| p (proto) | Yes | Protocol token (mcp, a2a, openapi, grpc, graphql, websocket, local) |
| a (auth) | Recommended | Auth scheme hint |
| s (desc) | Optional | Description (≤60 bytes) |
| k (pka) | Optional | Ed25519 public key (multibase) |

**Minimal footprint** — single TXT record for bootstrap. No capability semantics beyond freetext description.

---

## 4. Protocol Comparison for Noēsis

| Dimension | A2A | ANP | AID |
|-----------|-----|-----|-----|
| **Maturity** | Production (v1.0) | Active dev | IETF draft |
| **Identity** | Agent Cards | W3C DID (did:wba) | DNS TXT |
| **Discovery** | HTTP GET .well-known | .well-known + crawlers | DNS lookup |
| **Communication** | JSON-RPC/gRPC/REST | Dynamic negotiation | Discovery only |
| **Task Management** | Full lifecycle | None (info exchange) | None |
| **Streaming** | SSE + gRPC streams | None specified | None |
| **Privacy** | Task delegation model | Local decision model | N/A |
| **SDKs** | Python, JS, Go, Java, .NET | Python | None |
| **Adoption** | Google, 50+ partners | Chinese AI community | Early |

### Recommendation for Noēsis

**Primary**: A2A for Nous-to-Nous task communication (most mature, broadest SDK support, task lifecycle management).

**Identity layer**: ANP's `did:wba` concept for Nous identity (cryptographic identity embedded in identifier, decentralized).

**Discovery**: Custom registry (DNS-like) inspired by ANS naming, serving A2A Agent Cards.

**Internal messaging**: NATS (see networking research) for pub/sub, group comms, persistence — A2A for structured inter-agent tasks.
