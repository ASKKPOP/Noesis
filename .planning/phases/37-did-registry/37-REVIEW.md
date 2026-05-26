---
phase: 37-did-registry
reviewed: 2026-05-26T00:00:00Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - .github/workflows/rig-invariants.yml
  - grid/src/audit/append-registry-business-did-dissolved.ts
  - grid/src/audit/append-registry-business-did-registered.ts
  - grid/src/audit/append-registry-civic-did-issued.ts
  - grid/src/audit/append-registry-civic-did-revoked.ts
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/civic-registry/business-did-store.ts
  - grid/src/civic-registry/civic-did-store.ts
  - grid/src/civic-registry/government-session.ts
  - grid/src/civic-registry/index.ts
  - grid/src/civic-registry/types.ts
  - grid/src/civic-registry/vc-builder.ts
  - grid/src/api/routes/registry.ts
  - grid/src/api/policy.ts
  - grid/src/api/preHandlers/types.ts
  - grid/src/api/preHandlers/tryDid.ts
  - grid/test/api/registry-business.test.ts
  - grid/test/api/registry-dissolution.test.ts
  - grid/test/api/registry-lookup.test.ts
  - grid/test/api/registry-revocation.test.ts
  - grid/test/api/registry-routes.test.ts
  - grid/test/audit/append-registry-business-did-dissolved.test.ts
  - grid/test/audit/append-registry-business-did-registered.test.ts
  - grid/test/audit/append-registry-civic-did-issued.test.ts
  - grid/test/audit/append-registry-civic-did-revoked.test.ts
  - grid/test/audit/broadcast-allowlist.test.ts
  - grid/test/civic-registry/business-did-store.test.ts
  - grid/test/civic-registry/civic-did-store.test.ts
  - grid/test/civic-registry/government-session.test.ts
  - grid/test/civic-registry/vc-builder.test.ts
  - grid/test/scripts/check-civic-did-issuance-path.test.ts
  - scripts/check-civic-did-issuance-path.mjs
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-05-26
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

Phase 37 implements the DID Registry: four HTTP endpoints, four sole-producer audit emitters, two MySQL-backed store classes, a government-session JWT validator stub, a W3C VC v2.0 builder, and a CI gate script enforcing the D-V3-33 portal-gating constitutional invariant.

The 8-step sole-producer discipline is correctly applied across all four audit emitters. The closed-tuple payloads are sound. The `government_only` policy enforcement in `server.ts` correctly gates civic-DID revocation and business-DID dissolution before reaching route handlers. The `FORBIDDEN_KEY_PATTERN` negative lookahead `content(?!_hash)` correctly permits `court_conviction_ref_hash` and `content_hash` while blocking `content` plain keys. Privacy invariants (no `business_name`/`category` in audit, `court_conviction_ref` hashed in audit) are correctly implemented for revocation. The CI gate (`check-civic-did-issuance-path.mjs`) is wired in `rig-invariants.yml` and passes tests.

One critical security bug is present: the civic-oath signature in REG-01 is never verified against the oath text — only key ownership is proved. Three warnings cover the court-order ref divergence risk, the non-persisted business-dissolution court ref, and the APPROVED_IMPORTERS forward-compatibility entries. Two info items cover the jwtVerify algorithm options and a TS readonly violation in test mocks.

---

## Critical Issues

### CR-01: Civic oath not cryptographically bound to existence-key signature (REG-01)

**File:** `grid/src/api/routes/registry.ts:66-70`

**Issue:** The comment on line 66 says "Verify the existence-key signed the oath (T-37-13)" but `compactVerify(sig, key)` only verifies that the JWS is well-formed and signed by `key`. It does NOT verify that the JWS payload matches `oath`. The return value of `compactVerify` — which includes the signed bytes — is discarded. A caller can therefore submit any non-empty `civic_oath` string alongside a JWS(random bytes) signed with the correct existence key and the check passes. The oath is not committed to by the signature.

```typescript
// Current (broken): only proves key ownership
await compactVerify(sig, key);

// Fix: also verify the signed payload equals the oath text
const { payload: signedPayload } = await compactVerify(sig, key);
const expectedBytes = new TextEncoder().encode(oath);
if (
    signedPayload.length !== expectedBytes.length ||
    !signedPayload.every((b, i) => b === expectedBytes[i])
) {
    return reply.code(401).send({ error: 'invalid_signature' });
}
```

Add a corresponding test case: sign a different string with the correct key and send `civic_oath` with the original text — the handler should return 401.

---

## Warnings

### WR-01: Government JWT court_conviction_ref and request body ref are independent — body value used for DB and audit

**File:** `grid/src/api/routes/registry.ts:141-163`

**Issue:** `verifyGovernmentSession` (called in `server.ts:365`) extracts `court_conviction_ref` from the JWT claim and returns it as `result.courtConvictionRef`. However, `server.ts` discards this value — it only sets `req.didContext = { did: GOV_SESSION_ISSUER_DID, tier: 'government' }`. The revoke handler then independently reads `court_conviction_ref` from the request body (line 141), uses that body value as the plaintext stored in the DB (line 156 `markRevoked`), and hashes it for the audit (line 163 `sha256Hex(ref)`).

This means the JWT claim and the body ref can differ. A government principal who presents a valid JWT with claim `court_conviction_ref=CONVICTION-001` can submit a body with `court_conviction_ref=UNRELATED-STRING`, and it is UNRELATED-STRING that gets stored and hashed. The JWT claim serves only as a session-validity gate, not as the canonical court order identifier.

The same pattern applies to the dissolution endpoint (lines 278-282).

No existing test covers the JWT-ref != body-ref case. If the design intent is that the body ref is the canonical value (with the JWT ref only proving the session is for a court proceeding), document this explicitly. If the JWT ref should be the canonical value, forward it through `req.didContext` and use it in handlers:

```typescript
// In server.ts government_only branch:
req.didContext = {
    did: GOV_SESSION_ISSUER_DID,
    tier: 'government',
    courtConvictionRef: result.courtConvictionRef,  // carry the JWT claim
};

// In the revoke handler: use req.didContext.courtConvictionRef instead of body ref
// (still require body ref for explicit confirmation of the same value)
```

### WR-02: Business dissolution court_conviction_ref is not persisted anywhere

**File:** `grid/src/api/routes/registry.ts:278-295`, `grid/src/civic-registry/business-did-store.ts:83-95`

**Issue:** The dissolution endpoint requires `court_conviction_ref` in the request body as a constitutional discipline gate (line 278-282), and the government JWT must carry the same claim. However, once the dissolution succeeds, the court order reference is discarded entirely:

- `BusinessDidStore.markDissolved` has signature `(gridName, businessDid, dissolvedAtTick)` — no `courtConvictionRef` parameter.
- `business_did_registry` DB table has no `court_conviction_ref` column.
- The audit payload is a closed 4-tuple (`business_did, civic_did, dissolved_at_tick, grid_name`) with no court reference at all (neither plaintext nor hash).

This contrasts with civic-DID revocation where the ref is stored as plaintext in `civic_did_registry.court_conviction_ref` and as a SHA-256 hash in the audit. A dissolved business cannot be correlated with its court order at any layer. Consider adding `court_conviction_ref_hash` to the `business_did_dissolved` audit payload (which would require extending EXPECTED_KEYS to 5 and adding the column to `business_did_registry`), or at minimum document the asymmetry as an explicit decision in the phase research.

### WR-03: APPROVED_IMPORTERS in CI gate pre-clears store files that do not currently import producers

**File:** `scripts/check-civic-did-issuance-path.mjs:48-52`

**Issue:** `APPROVED_IMPORTERS` includes `grid/src/civic-registry/civic-did-store.ts` and `grid/src/civic-registry/business-did-store.ts` as "anticipated v3.x — forward-compat" entries. Neither file currently imports any `append-registry-*` producer. This means future code that adds such an import to either store file will silently bypass the D-V3-33 constitutional gate without any CI failure.

The gate comment notes this is intentional forward-compatibility. If so, the APPROVED_IMPORTERS list should require a documented decision ticket before any new entry is added — the current comment is insufficient justification for a constitutional carve-out. Consider removing the two forward-compat entries and adding them back only when the actual import lands, with a code-review justification at that time.

---

## Info

### IN-01: jwtVerify in government-session.ts has no explicit algorithm restriction

**File:** `grid/src/civic-registry/government-session.ts:44`

**Issue:** `jwtVerify(token, publicKey)` is called without an `algorithms` option. For an EC P-256 key, jose will only accept ES256-signed tokens by default, so this is low risk in practice. Adding the restriction makes the contract explicit and protects against library version changes that might broaden algorithm acceptance:

```typescript
const { payload } = await jwtVerify(token, publicKey, { algorithms: ['ES256'] });
```

### IN-02: Test mock assigns to `readonly`-typed record fields, which is a TypeScript error at compile time

**File:** `grid/test/api/registry-dissolution.test.ts:98-99`, `grid/test/api/registry-lookup.test.ts:49-51`

**Issue:** `BusinessDidRecord` and `CivicDidRecord` declare all fields `readonly`. The mock `markDissolved` and `markRevoked` implementations mutate `record.status`, `record.dissolvedAtTick`, etc. directly on the Map-stored record. This works at runtime (JS has no runtime readonly enforcement) but produces TypeScript compile errors. The mock should cast to a mutable type or use `Object.assign`:

```typescript
// Option: cast the record to a mutable type before mutation
const mutable = record as { -readonly [K in keyof BusinessDidRecord]: BusinessDidRecord[K] };
mutable.status = 'dissolved';
mutable.dissolvedAtTick = dissolvedAtTick;
```

This only affects test files and does not affect reliability (tests run correctly at runtime).

---

_Reviewed: 2026-05-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
