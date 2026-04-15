# Research: Naming, Identity, and Discovery Systems

## 1. ANS (Agent Name Service) — IETF Draft

**Source**: draft-narajala-ans-00 (IETF)
**Implementer**: GoDaddy (primary commercial partner)

### Naming Format

```
Protocol://AgentID.Capability.Provider.vX.Y.Z[.Extension]
```

Example: `a2a://textProcessor.DocumentTranslation.AcmeCorp.v2.1.hipaa`

| Component | Purpose |
|-----------|---------|
| Protocol | Communication standard (a2a, mcp, acp) |
| AgentID | Unique identifier within provider/protocol scope |
| Capability | Primary service/function |
| Provider | Organization |
| Version | Semantic versioning (MAJOR.MINOR.PATCH) |
| Extension | Optional deployment metadata |

**Any component change creates a new identity** — even minor version bumps revoke the old certificate.

### Resolution Algorithm

1. Parse ANSName components
2. Query Agent Registry for match (Protocol, AgentID, Capability, Provider)
3. If no match → ERROR("Agent not found")
4. If multiple matches → version negotiation (sort semver desc, filter by range)
5. Retrieve endpoint record {data, signature, Cert}
6. Verify signature and certificate chain
7. Return verified endpoint data
8. TTL: 300 seconds default for caching

### Registration (4 phases)

1. Agent submits registration + CSR (Certificate Signing Request)
2. Registration Authority validates identity against policies
3. RA requests X.509 certificate from CA using validated CSR
4. Certificate + agent info stored in registry

### PKI Structure

- X.509 certificates bind public key to verified identity
- ANSName, org affiliation, attributes embedded in certificate
- Private keys in HSMs/secure enclaves
- Certificate revocation via CRL/OCSP
- Hierarchical trust chain through CAs

### GoDaddy Implementation

**Four DNS Records Per Agent**:
```
_ans.sentiment       IN TXT   "url=https://sentiment.example.com/agent-card.json"
_mcp._tcp.sentiment  IN HTTPS 1 . alpn=h2 port=443
_443._tcp.sentiment  IN TLSA  3 1 1 [cert_hash]
_ra-badge.sentiment  IN TXT   "v=ra-badge1; url=https://transparency..."
```

**Dual Certificate Model**:
- Public server certificate: Standard TLS (90-day, browser-trusted)
- Private identity certificate: Version-bound, ANS extensions, agent-to-agent signing

**Scale**: DNS handles billions queries/sec. Certificate pipeline: <100ms p99 DNS query, <5ms DNSSEC overhead, ~20ms HSM signing for transparency log.

**Cloudflare partnership** (April 2026) for open agentic web integration.

---

## 2. agent:// URI Scheme

**Source**: arXiv 2601.14567 (January 2026, academic)

### URI Format

```
agent://trust-root/capability-path/agent-id[?query][#fragment]
```

Example: `agent://anthropic.com/assistant/chat/agent_01h455vb4pex5vsknk084sn02q`

| Component | Format | Purpose |
|-----------|--------|---------|
| trust-root | DNS hostname | Organization vouching for agent |
| capability-path | hierarchical segments | Function description |
| agent-id | `agent_` + 26 base32 chars (TypeID/UUIDv7) | Globally unique, sortable by creation time |

### Trust Root Verification

Publisher serves verification keys at: `https://{trust-root}/.well-known/agent-keys.json`

### DHT-Based Discovery

Kademlia-style DHT with trust-root scoping:
```
key = SHA256(canonical(trust_root) || "/" || canonical(cap_path))
```

Registration records: {Agent URI, Endpoints, PASETO attestation token, Expiration, Timestamp}

### PASETO v4.public Token Claims

| Claim | Purpose |
|-------|---------|
| iss | Issuing trust root |
| sub | Agent URI attested |
| aud | Audience restriction |
| iat/exp | Issued/expiration times |
| capabilities | Authorized capability paths |

### Performance

All operations under 5 microseconds. F1=1.0 across 10,000 agents. Zero collisions on 369 production tools.

### Assessment

Elegant separation of identity/addressing/routing with formal proofs. **No production implementation** — purely academic at this stage.

---

## 3. W3C DID Core

**Source**: W3C Recommendation (did-core)

### DID Syntax

```
did = "did:" method-name ":" method-specific-id
```

### DID Document Structure

```json
{
  "@context": ["https://www.w3.org/ns/did/v1"],
  "id": "did:example:123456789abcdefghi",
  "controller": "did:example:bcehfew7h32f32h7af3",
  "verificationMethod": [{
    "id": "#keys-1",
    "type": "Ed25519VerificationKey2020",
    "controller": "did:example:123456789abcdefghi",
    "publicKeyMultibase": "zH3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV"
  }],
  "authentication": ["#keys-1"],
  "assertionMethod": ["#keys-1"],
  "keyAgreement": [...],
  "service": [{
    "id": "#agent",
    "type": "AgentService",
    "serviceEndpoint": "https://example.org/agent"
  }]
}
```

### Verification Relationships

- `authentication` — proving control of DID
- `assertionMethod` — making verifiable claims
- `keyAgreement` — establishing encrypted comms
- `capabilityInvocation` — invoking capabilities
- `capabilityDelegation` — delegating to others

### Resolution

DID → method-specific resolver → DID document + metadata

---

## 4. Comparison Matrix

| Dimension | ANS (IETF) | agent:// URI | A2A Agent Cards | AID/ACDP | ANP did:wba |
|-----------|------------|-------------|-----------------|----------|-------------|
| **Identity** | X.509 PKI | PASETO tokens | JSON metadata | DNS TXT + Ed25519 | W3C DID |
| **Naming** | `proto://id.cap.provider.vX` | `agent://root/path/id` | FQDN + .well-known | `_agent.<domain>` | DID URI |
| **Discovery** | Registry + version negotiation | DHT (Kademlia) | HTTP GET | DNS TXT lookup | .well-known + crawlers |
| **Auth** | X.509 + mTLS + OAuth2 | PASETO v4.public | APIKey/OAuth2/OIDC/mTLS | Ed25519 PKA (RFC 9421) | DID doc + ECDHE |
| **Scalability** | DNS-scale (billions/sec) | Sub-5us operations | HTTP-scale | DNS-scale | Web-scale |
| **Maturity** | IETF draft + GoDaddy prod | Academic paper | Production (v1.0) | IETF draft | Active dev |
| **Strength** | Leverages DNS/PKI at scale | Formal proofs, elegant | Simple, industry-backed | Minimal footprint | Fully decentralized |
| **Weakness** | Complex naming, vendor-driven | No implementation | No naming/versioning | No capability semantics | DID resolution overhead |

---

## 5. Recommendation for Noēsis

### Naming System: `nous://name.realm`

Inspired by ANS but simplified for a single-world context:

```
nous://<name>.<realm>
```

- `nous://sophia.thinkers` — Sophia in the Thinkers realm
- `nous://hermes.traders` — Hermes in the Traders realm

### Identity: Cryptographic Keys

Each Nous has:
- Ed25519 key pair (generated at birth)
- Key fingerprint embedded in registry entry
- DID-inspired document describing capabilities and endpoints

### Discovery: Central Registry + Agent Cards

- Registry service maps `nous://` names to endpoints
- Each Nous serves an A2A-compatible Agent Card describing capabilities
- Capability-based search ("find Nous that can translate Japanese")

### Why This Hybrid

- ANS naming is too complex for a single-world scenario
- Pure DID adds resolution overhead unnecessary for a controlled world
- A2A Agent Cards are the most practical capability description format
- Central registry is fast and simple; decentralization unnecessary at start
- Can evolve to ANS/DID when the world federates across networks
