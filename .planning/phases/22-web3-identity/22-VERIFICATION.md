---
phase: 22-web3-identity
verified: 2026-05-20T00:00:00Z
status: human_needed
score: 19/20 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Visit /portal in browser — should redirect to /portal/auth (no JWT cookie)"
    expected: "Browser is redirected to /portal/auth without showing portal content"
    why_human: "Next.js Edge middleware redirect cannot be verified without running server"
  - test: "On /portal/auth, connect MetaMask or injected wallet, then click Sign In"
    expected: "Wallet prompts to sign a SIWE message; after signing, page redirects to /portal"
    why_human: "Wallet signing is a browser interaction requiring a real wallet extension"
  - test: "After sign-in, visit /portal/auth again"
    expected: "Redirects back to /portal (JWT cookie present, middleware passes through)"
    why_human: "Cookie-based redirect loop prevention requires live browser session"
  - test: "Call Grid /api/v1/portal/auth/me with the cookie"
    expected: "Returns { did, eth_address } matching the connected wallet address"
    why_human: "Requires running Grid server and a valid JWT cookie from the browser flow"
  - test: "Sign in twice with the same wallet address"
    expected: "human.joined fires only on first sign-in; second sign-in gets new JWT without re-firing the audit event"
    why_human: "Requires two sequential browser sign-in flows and Grid audit log inspection"
---

# Phase 22: Web3 Identity Verification Report

**Phase Goal:** SIWE (Sign-In With Ethereum) auth, MetaMask/WalletConnect, human DID issuance (`did:noesis:human:<address>`), `human_users` MySQL table, JWT session layer. Allowlist 43→44 (+1: human.joined).
**Verified:** 2026-05-20T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `human_users` MySQL migration exists as version 9 in schema.ts | VERIFIED | `grid/src/db/schema.ts` lines 196-210: `version: 9, name: 'create_human_users'`, DDL confirmed |
| 2 | HumanRegistry.createHuman() stores record keyed on eth address, returns HumanRecord with did, eth_address, created_at | VERIFIED | `grid/src/human/HumanRegistry.ts` lines 24-42: creates DID `did:noesis:human:${address}`, stores in both byAddress and byDid maps |
| 3 | HumanRegistry.findByAddress() returns record or undefined | VERIFIED | `grid/src/human/HumanRegistry.ts` line 46-48: case-insensitive lookup via lowercased key |
| 4 | HumanRegistry.findByDid() returns record or undefined | VERIFIED | `grid/src/human/HumanRegistry.ts` line 51-53 |
| 5 | Human DID format is `did:noesis:human:<lowercased-eth-address>` matching WEB3-05 regex | VERIFIED | `HUMAN_DID_RE = /^did:noesis:human:0x[0-9a-f]{40}$/i` in HumanRegistry.ts; DID constructed as `did:noesis:human:${address}` with address lowercased |
| 6 | HumanRegistry exported from grid/src/index.ts | VERIFIED | `grid/src/index.ts` line 26: `export { HumanRegistry } from './human/index.js'` |
| 7 | GET /api/v1/portal/auth/nonce returns {nonce: string} with 5-min TTL | VERIFIED | `grid/src/api/portal/auth.ts` lines 38-42: randomUUID nonce stored in nonceMap with timestamp |
| 8 | POST /api/v1/portal/auth/verify accepts {message, signature}, returns {did, eth_address} with httpOnly JWT cookie | VERIFIED | `grid/src/api/portal/auth.ts` lines 47-130: full SIWE verify flow, JWT issued via jose ES256, cookie name `noesis_portal_token` httpOnly |
| 9 | POST /api/v1/portal/auth/logout clears JWT cookie | VERIFIED | `grid/src/api/portal/auth.ts` lines 132-135: clearCookie + returns {ok: true} |
| 10 | GET /api/v1/portal/auth/me returns {did, eth_address} from JWT or 401 | VERIFIED | `grid/src/api/portal/auth.ts` lines 138-151: jwtVerify with publicKey, returns payload fields |
| 11 | First connect fires human.joined; reconnect does NOT fire second event | VERIFIED (code) | `auth.ts` line 92: `const isNew = human === undefined`; appendHumanJoined called only when `isNew` and `!human` — NEEDS human test to confirm end-to-end |
| 12 | ETH address is hashed in human.joined payload — never plaintext | VERIFIED | `auth.ts` line 97: `createHash('sha256').update(ethAddress.toLowerCase()).digest('hex')`; key is `eth_address_hash` not `eth_address` |
| 13 | broadcast-allowlist grows from 43 to 44 with human.joined | VERIFIED | `broadcast-allowlist.ts` line 178: `'human.joined',     // (44) {human_did, eth_address_hash, grid_name, tick}` |
| 14 | JWT is ES256, 24h expiry, httpOnly cookie named `noesis_portal_token` | VERIFIED | `auth.ts`: `generateKeyPair('ES256')`, `.setExpirationTime('24h')`, `httpOnly: true`, `COOKIE_NAME = 'noesis_portal_token'` |
| 15 | wagmi v2, viem, @wagmi/connectors in dashboard dependencies | VERIFIED | `dashboard/package.json`: wagmi@^2.0.0, viem@^2.0.0, @wagmi/connectors@^5.0.0, @tanstack/react-query@^5.0.0 |
| 16 | WagmiProvider wraps /portal/* routes via portal layout | VERIFIED | `dashboard/src/app/portal/layout.tsx` lines 11-25: WagmiProvider + QueryClientProvider wrapping children |
| 17 | ConnectWalletButton renders connect/disconnect states using wagmi hooks | VERIFIED | `ConnectWalletButton.tsx`: useAccount, useConnect, useDisconnect; truncated address + Disconnect when connected; Connect Wallet when not |
| 18 | signInWithEthereum fetches nonce, constructs SIWE message, signs, POSTs to verify, returns HumanUser | VERIFIED | `dashboard/src/lib/web3/siwe-auth.ts`: 5-step flow fully implemented |
| 19 | useHumanAuthStore holds {did, eth_address} or null, persists across page navigations within session | VERIFIED | `dashboard/src/lib/stores/human-auth-store.ts`: Zustand store with currentUser, setUser, clearUser |
| 20 | End-to-end SIWE flow works in browser (human checkpoint from Plan 22-04 Task 3) | NEEDS HUMAN | Plan 22-04 `tasks_completed: 2, tasks_total: 3` — checkpoint:human-verify gate pending per SUMMARY |

**Score:** 19/20 truths verified (1 pending human checkpoint)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/db/schema.ts` | Migration version 9 — human_users table | VERIFIED | Lines 196-210 |
| `grid/src/human/HumanRegistry.ts` | HumanRegistry with createHuman/findByAddress/findByDid | VERIFIED | All methods present and substantive |
| `grid/src/human/types.ts` | HumanRecord, CreateHumanParams interfaces | VERIFIED | Both exported |
| `grid/src/human/index.ts` | Barrel export for human/ directory | VERIFIED | Exports HumanRegistry and types |
| `grid/src/index.ts` | Public re-export of HumanRegistry | VERIFIED | Line 26 |
| `grid/src/audit/append-human-joined.ts` | Sole producer for human.joined audit event | VERIFIED | DID_RE, HEX64_RE, HumanJoinedPayload, 4-key closed tuple, payloadPrivacyCheck |
| `grid/src/api/portal/auth.ts` | registerPortalAuthRoutes — all four /portal/auth/* endpoints | VERIFIED | All 4 routes substantive |
| `grid/src/api/portal/index.ts` | Barrel for portal route registrars | VERIFIED | registerPortalRoutes exported |
| `grid/src/api/server.ts` | humanRegistry optional field + registerPortalRoutes wired | VERIFIED | Line 81: `humanRegistry?: HumanRegistry`; line 377: `registerPortalRoutes(app, services)` |
| `grid/src/audit/broadcast-allowlist.ts` | human.joined as entry 44 | VERIFIED | Line 178 |
| `dashboard/package.json` | wagmi, viem, @wagmi/connectors, @tanstack/react-query | VERIFIED | All 4 in dependencies |
| `dashboard/src/lib/web3/wagmi-config.ts` | wagmiConfig with injected + WalletConnect connectors | VERIFIED | mainnet + sepolia, both connectors |
| `dashboard/src/app/portal/layout.tsx` | Portal root layout with WagmiProvider | VERIFIED | WagmiProvider + QueryClientProvider |
| `dashboard/src/app/portal/page.tsx` | Portal home page | VERIFIED | Renders ConnectWalletButton (middleware guards access) |
| `dashboard/src/components/portal/ConnectWalletButton.tsx` | Wallet connect/disconnect UI | VERIFIED | connect/disconnect states, truncated address |
| `dashboard/src/lib/web3/siwe-auth.ts` | signInWithEthereum() + HumanUser | VERIFIED | Full 5-step SIWE flow |
| `dashboard/src/lib/stores/human-auth-store.ts` | Zustand store — currentUser, setUser, clearUser | VERIFIED |  |
| `dashboard/src/app/portal/auth/page.tsx` | Sign-in page — wallet connect + SIWE sign-in; redirects to /portal | VERIFIED | ConnectWalletButton + Sign In button + useEffect redirect |
| `dashboard/src/middleware.ts` | Middleware protecting /portal/*; excludes /portal/auth | VERIFIED | `!pathname.startsWith(AUTH_PATH)` guard prevents loop |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `grid/src/human/HumanRegistry.ts` | `grid/src/human/types.ts` | import type { HumanRecord, CreateHumanParams } | WIRED | Confirmed via grep |
| `grid/src/index.ts` | `grid/src/human/index.js` | export { HumanRegistry } | WIRED | Line 26 |
| `grid/src/api/portal/auth.ts` | `grid/src/human/HumanRegistry.ts` | services.humanRegistry.createHuman / findByAddress | WIRED | Lines 91, 94 via GridServices.humanRegistry |
| `grid/src/api/portal/auth.ts` | `grid/src/audit/append-human-joined.ts` | appendHumanJoined(services.audit, ...) | WIRED | Line 101 |
| `grid/src/api/server.ts` | `grid/src/api/portal/index.ts` | registerPortalRoutes(app, services) | WIRED | Lines 28 (import), 377 (call) |
| `dashboard/src/app/portal/layout.tsx` | `dashboard/src/lib/web3/wagmi-config.ts` | import { wagmiConfig } | WIRED | Line 13 |
| `dashboard/src/app/portal/auth/page.tsx` | `dashboard/src/lib/web3/siwe-auth.ts` | import { signInWithEthereum } | WIRED | Line 18; called at line 41 |
| `dashboard/src/app/portal/auth/page.tsx` | `dashboard/src/lib/stores/human-auth-store.ts` | useHumanAuthStore().setUser(user) | WIRED | Line 25 (store), 46 (setUser call) |
| `dashboard/src/lib/web3/siwe-auth.ts` | /api/v1/portal/auth/nonce + /api/v1/portal/auth/verify | fetch() calls with credentials:include | WIRED | Lines 43, 73 |
| `dashboard/src/middleware.ts` | noesis_portal_token JWT cookie | request.cookies.get('noesis_portal_token') | WIRED | Line 24 |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| WEB3-01 | 22-01, 22-02, 22-03, 22-04 | SIWE auth via wagmi + WalletConnect, no username/password | SATISFIED | wagmi config with injected+WalletConnect, siwe-auth.ts, SIWE verify endpoint |
| WEB3-02 | 22-01, 22-02 | human_users table, DID `did:noesis:human:<address>`, HumanRegistry | SATISFIED | Migration v9, HumanRegistry, DID construction confirmed |
| WEB3-03 | 22-02, 22-04 | JWT 24h ES256, Next.js middleware validates on /portal/*, httpOnly cookie | SATISFIED | jose ES256, 24h expiry, httpOnly, middleware coverage confirmed |
| WEB3-04 | 22-02 | human.joined fires on first creation, ETH address hashed (plan: SHA-256; research: BLAKE2b) | SATISFIED (hash deviation noted) | SHA-256 used throughout plan + code; raw address never in audit chain |
| WEB3-05 | 22-01 | DID regex `/^did:noesis:[a-z0-9_\-]+$/i` | SATISFIED | HUMAN_DID_RE in HumanRegistry.ts, DID_RE in append-human-joined.ts |
| WEB3-06 | 22-02 | Re-connect gets new JWT; no second human.joined | SATISFIED (code) | isNew guard confirmed; end-to-end needs human verification |

**Note on WEB3 IDs and REQUIREMENTS.md:** WEB3-01 through WEB3-06 are defined in `.planning/research/v2.5-requirements.md`, not in `.planning/REQUIREMENTS.md` (which covers v2.2 and v2.4). These are v2.5 requirements from the research file, which is the authoritative source for Phase 22. All 6 WEB3 requirement IDs are accounted for.

**Hash algorithm deviation:** WEB3-04 in the research file specifies BLAKE2b, but the PLAN files (22-02-PLAN.md, plan interface at line 150) explicitly prescribe SHA-256: `createHash('sha256').update(address.toLowerCase()).digest('hex')`. The implementation faithfully follows the PLAN. Both the plan author and executor used SHA-256 consistently. The privacy invariant (hash not plaintext) is satisfied. This is a plan-level design choice deviating from the research requirement, not a code-level gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `grid/src/api/portal/auth.ts` | 31 | `generateKeyPair('ES256')` at module load — ephemeral key | Warning | JWT sessions invalidated on Grid restart (code review CR-01) |
| `grid/src/api/portal/auth.ts` | 27-40 | nonceMap never pruned except on verify | Warning | Unbounded memory growth if nonces are fetched but never verified (code review CR-03) |
| `dashboard/src/app/portal/page.tsx` | 1-20 | Server component with no client-side auth guard | Info | Unauthenticated users briefly see portal UI if middleware passes stale cookie (code review WR-03) |
| `dashboard/src/lib/stores/human-auth-store.ts` | 18-22 | In-memory only, no persistence | Info | currentUser resets to null on page reload; /me endpoint exists to solve this (code review IN-01) |

No stub-level blockers found. Anti-patterns above are code quality issues documented in the code review (22-REVIEW.md). None prevent the Phase 22 goal from being achievable — they are known trade-offs accepted for v2.5 scope.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly (grid) | `cd grid && npx tsc --noEmit` | Exit 0, no output | PASS |
| TypeScript compiles cleanly (dashboard) | `cd dashboard && npx tsc --noEmit` | Exit 0, no output | PASS |
| human_users migration present | `grep -n "version: 9" grid/src/db/schema.ts` | Line 196 match | PASS |
| human.joined in allowlist | `grep -n "human.joined" grid/src/audit/broadcast-allowlist.ts` | Lines 177-178 | PASS |
| HumanRegistry in grid index | `grep -n "HumanRegistry" grid/src/index.ts` | Line 26 match | PASS |
| registerPortalRoutes in server.ts | `grep -n "registerPortalRoutes" grid/src/api/server.ts` | Lines 28, 377 | PASS |
| All 4 auth route files exist | `ls grid/src/api/portal/` | auth.ts, index.ts | PASS |
| All dashboard portal files exist | `ls dashboard/src/app/portal/` | auth/, layout.tsx, page.tsx | PASS |
| End-to-end browser SIWE flow | Browser test | Pending checkpoint | SKIP — needs human |

Step 7b spot-checks skipped for browser-dependent flows (wallet signing, cookie session). TypeScript compilation is the strongest automated proxy for structural correctness.

### Human Verification Required

#### 1. End-to-End SIWE Auth Flow (Blocking — Plan 22-04 Task 3 checkpoint)

**Test:**
1. Start Grid: `cd grid && npm run dev`
2. Start Dashboard: `cd dashboard && npm run dev`
3. Visit `http://localhost:3000/portal` — should redirect to `/portal/auth` (no cookie)
4. On `/portal/auth`, click "Connect Wallet" — MetaMask or injected wallet should prompt
5. After connecting, click "Sign In" — wallet should prompt to sign a SIWE message
6. After signing, verify the page redirects to `/portal`
7. Visit `http://localhost:3000/portal/auth` again — should redirect back to `/portal` (cookie present)
8. Call `curl -b "noesis_portal_token=<token>" http://localhost:3001/api/v1/portal/auth/me` — should return `{ did, eth_address }`

**Expected:** Steps 3-8 all behave as described above with no errors.
**Why human:** Wallet signing is a browser interaction requiring a real wallet extension; cookie-based session flows require a running server and browser environment.

#### 2. human.joined Fires Once Only (WEB3-06)

**Test:**
1. Sign in with a wallet address for the first time
2. Check Grid audit log for `human.joined` event — should appear once
3. Sign out (POST /api/v1/portal/auth/logout)
4. Sign in with the same wallet address again
5. Check Grid audit log — second `human.joined` must NOT appear

**Expected:** Exactly one `human.joined` event per unique ETH address per grid, regardless of how many sign-ins occur.
**Why human:** Requires sequenced browser sign-in flows and audit chain log inspection.

### Gaps Summary

No blocking gaps found in the static code analysis. All Phase 22 artifacts exist, are substantive (not stubs), and are correctly wired together. TypeScript compiles cleanly in both grid/ and dashboard/.

The only unresolved item is the human verification checkpoint from Plan 22-04 Task 3, which was explicitly marked as a blocking gate in the plan (`autonomous: false`, `gate="blocking"`). The SUMMARY documents `tasks_completed: 2, tasks_total: 3` confirming this checkpoint was not yet approved. Status is `human_needed`, not `gaps_found`.

**Known issues from code review (not verification failures):**
- CR-01: Ephemeral JWT key pair — sessions lost on restart (acceptable for v2.5)
- CR-02: CORS may need `credentials: true` + POST method for browser clients (warrants testing in human checkpoint)
- CR-03: nonceMap not pruned on fetch — DoS risk in production
- WEB3-04 hash: SHA-256 used instead of BLAKE2b from research requirement; plan explicitly prescribed SHA-256

---

_Verified: 2026-05-20T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
