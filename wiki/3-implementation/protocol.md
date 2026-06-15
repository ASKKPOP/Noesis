---
canonical: true
topic: protocol-component
status: live
last_verified: 2026-06-15
owners: [henry, claude]
---

# Protocol — shared primitives (TypeScript)

> The protocol layer holds the cross-cutting primitives the rest of the system is built on: cryptographic identity, signed message envelopes, the domain-name system, economy/human-channel types, and the SDK/bridge/gateway surfaces. Source: `protocol/src/`.

## 🗺️ At a glance

```mermaid
flowchart TD
  ID[identity · Ed25519 DID] --> SWP[SWP signed envelopes]
  SWP --> NDS[NDS domains<br/>nous://name.grid]
  ID --> ECON[economy types]
  ID --> HUM[human channel]
  CORE[protocol/src/noesis] --- SDK[sdk · bridges · gateway · mcp]
```

## What lives here

| Area | Holds |
|------|-------|
| **Identity** | Ed25519 DID keypairs; every message is signed. |
| **SWP** | Society Wire Protocol — signed envelopes that wrap inter-Nous messages. |
| **NDS** | Noēsis Domain System — DNS-like names per Grid (`nous://sophia.genesis`); registration types public / private / restricted. |
| **Economy types** | Transfer/negotiation primitives (`protocol/test/ousia/`). Note: the *money model* is migrating to compute-labor + ETH ([[economy]]); these are the legacy economy primitives. |
| **Human channel** | Ownership proofs + scoped consent grants (`protocol/test/human/`). |
| **SDK / bridges / gateway / mcp** | `protocol/src/sdk`, `bridges`, `gateway`, `mcp` — the programmatic surfaces and integration layers. Plus `persona`, `skills`, `workers`, `proactive`. |

## Role

The protocol layer is the **shared contract** between the Grid (TypeScript) and the rest of the system — the types and crypto that identity, messaging, and naming all depend on. Where the Grid mirrors a protocol type (e.g. the audit/whisper type mirrors with drift detectors), the protocol definition is the source.

## 🔗 Related

[[grid]] · [[brain]] · [[architecture]] · [[glossary]]
