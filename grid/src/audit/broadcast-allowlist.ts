/**
 * Broadcast Allowlist — sovereignty enforcement boundary.
 *
 * Rationale (PHILOSOPHY.md §1, §4, §7): Nous have sovereign intelligence,
 * sovereign memory, and are observed without being controlled. That means
 * LLM prompts, wiki contents, reflections, raw thoughts, and emotion
 * deltas MUST NEVER leave the Grid process via any broadcast channel.
 *
 * This module is consulted by the Phase 2 WsHub BEFORE forwarding any
 * AuditChain entry to WebSocket clients. It enforces two invariants:
 *
 *   1. Default-deny: only explicitly-listed event types are broadcast.
 *      Any new event type added to the chain stays server-side by default.
 *
 *   2. Payload lint: even within an allowlisted event type, the payload
 *      must not contain keys that match known "inner life" field names.
 *      If it does, that's a bug at the producer — the sanitization must
 *      happen at the NousRunner boundary, not here. This module is the
 *      last line of defense, not the first.
 *
 * See: PITFALLS.md §C2 (critical pitfall — privacy leak).
 */

/** Locked allowlist (v1 + Phase 5 + Phase 6 + Phase 7 + Phase 8 + Phase 10a + Phase 10b + Phase 11 + Phase 12 + Phase 13 + Phase 15 + Phase 16 + Phase 17 + Phase 18 + Phase 19 + Phase 25b + Phase 27 + Phase 28 + Phase 33 + Phase 36 + Phase 37) — exactly these 64 event types.
 *  Phase 27 (CHAT-04): +1 human.spoke at position 52.
 *  Phase 28 (SPAWN-04): +1 nous.spawned_by_human at position 53.
 *  Phase 33 (OBS-08..10): +3 portal.auth.login, portal.auth.register, human.identified (positions 54-56).
 *  Phase 36 (VIS-05): +4 portal.did_issued, portal.did_revoked, grid.recognition_granted, grid.recognition_revoked (positions 57-60).
 *  Phase 37 (REG-06): +4 registry.civic_did_issued, registry.civic_did_revoked, registry.business_did_registered, registry.business_did_dissolved (positions 61-64).
 *  v1 (Phase 1, per 01-CONTEXT.md): 10 events.
 *  Phase 5 (REV-02): +1 'trade.reviewed' — externally observable reviewer verdict;
 *  payload shape D-03, 3 keys on pass / 5 keys on fail, all privacy-clean (see D-12 test).
 *  Phase 6 (AGENCY-02, AGENCY-03): +5 operator.* events (D-10 tuple order locked).
 *  Phase 7 (DIALOG-02): +1 'telos.refined' at position 17 — Nous-initiated
 *  hash-only refinement after peer dialogue.
 *  Phase 8 (AGENCY-05): +1 'operator.nous_deleted' at position 18 — H5 Sovereign
 *  Operations, sole operator-initiated tombstone event. Closed 5-key payload:
 *  {tier:'H5', action:'delete', operator_id, target_did, pre_deletion_state_hash}.
 *  Emitted ONLY via appendNousDeleted() (grid/src/audit/append-nous-deleted.ts).
 *  Phase 10a (DRIVE-03): +1 'ananke.drive_crossed' at position 19 — Nous-internal
 *  drive pressure threshold crossings. Closed 5-key payload:
 *  {did, tick, drive, level, direction}. level ∈ {low,med,high};
 *  direction ∈ {rising,falling}. Emitted ONLY via appendAnankeDriveCrossed()
 *  (grid/src/ananke/append-drive-crossed.ts).
 *  Phase 10b (BIOS-02, BIOS-03): +2 bios lifecycle events at positions 20-21.
 *   - 'bios.birth' — Nous spawn boundary. Closed 3-key payload:
 *     {did, psyche_hash, tick}. Emitted ONLY via appendBiosBirth()
 *     (grid/src/bios/appendBiosBirth.ts).
 *   - 'bios.death' — Nous tombstone boundary. Closed 4-key payload:
 *     {cause, did, final_state_hash, tick}. cause ∈ {starvation, operator_h5,
 *     replay_boundary}. Emitted ONLY via appendBiosDeath()
 *     (grid/src/bios/appendBiosDeath.ts).
 *  Chronos is READ-SIDE ONLY per D-10b-11 — no chronos.* wire events.
 *  Phase 11 (WHISPER-04): +1 'nous.whispered' at position 22 — closed 4-tuple
 *   {ciphertext_hash, from_did, tick, to_did}; sole producer
 *   grid/src/whisper/appendNousWhispered.ts (to land in Wave 2).
 *   Per D-11-01 / CONTEXT-11.
 *  Phase 12 (VOTE-01..04): +4 governance events at positions 23..26 — closed payloads
 *   `proposal.opened {6}`, `ballot.committed {3}`, `ballot.revealed {4}`,
 *   `proposal.tallied {6}`. Sole producers in `grid/src/governance/append*.ts`
 *   (Wave 2). Per D-12-01 / CONTEXT-12.
 *  Phase 13 (REPLAY-02): +1 'operator.exported' at position 27 — closed 6-key payload:
 *   {tier:'H5', operator_id, start_tick, end_tick, tarball_hash, requested_at}.
 *   Sole producer grid/src/audit/append-operator-exported.ts. Per D-13-09 / REPLAY-02.
 *  Phase 15 (REFLEX-02): +3 nous.reflection_authored, nous.self_model_revised, nous.creed_violation at positions 28-30.
 *  Phase 16 (SLEEP-01): +2 nous.sleep.entered, nous.sleep.completed at positions 31-32.
 *  Phase 17 (D-17-02): +4 iris.* events at positions 33-36 (allowlist 32→36).
 *   - 'iris.belief_revised'           (33) — closed 4-key {nous_did, tick, target_did, belief_hash}
 *   - 'iris.context_invoked'          (34) — closed 3-key {nous_did, tick, belief_count}
 *   - 'iris.contradiction_detected'   (35) — closed 4-key {nous_did, tick, target_did, contradiction_hash}
 *   - 'iris.prior_seeded'             (36) — closed 4-key {nous_did, tick, target_did, seed_event_hash}
 *  All 4 emitted ONLY via grid/src/iris/append*.ts sole-producer emitters (D-17-08).
 *  Phase 18 (SKILL-03 / D-18-09): +3 skill.* events at positions 37-39 (allowlist 36→39).
 *   - 'skill.taught'    (37) — closed 5-key {learner_did, parent_hash, skill_hash, teacher_did, tick}
 *   - 'skill.inferred'  (38) — closed 4-key {learner_did, skill_hash, source_event_hash, tick}
 *   - 'skill.rejected'  (39) — closed 3-key {learner_did, rejection_reason, tick}; reason ∈ {low_trust, structural_invalid, quota_exceeded}
 *  All 3 emitted ONLY via grid/src/skills/append*.ts sole-producer emitters (D-18-07/09).
 *  Tuple ORDER is locked; any reorder fails broadcast-allowlist.test.ts.
 *  Phase 25b (SANCTION-01..06 / D-25b-07/08): +6 operator.* sanction events at positions 46..51 (allowlist 45→51).
 *   All 6 emitted ONLY via grid/src/audit/append-operator-*.ts sole-producer emitters (D-25b-09).
 *   Reason plaintext NEVER crosses the wire — only reason_hash (HEX64_RE) per D-25b-11.
 */
export const ALLOWLIST_MEMBERS: readonly string[] = [
    'nous.spawned',
    'nous.moved',
    'nous.spoke',
    'nous.direct_message', // metadata only — payload must not contain message body
    'trade.proposed',
    'trade.reviewed',      // Phase 5 (REV-02)
    'trade.settled',
    'law.triggered',
    'tick',
    'grid.started',
    'grid.stopped',
    // Phase 6 (AGENCY-02, AGENCY-03) — operator agency events.
    // Shared payload contract: { tier, action, operator_id, target_did? }
    // All five emitted from grid/src/api/operator/* handlers after
    // appendOperatorEvent() validates tier-required invariant (D-13).
    'operator.inspected',      // H2 Reviewer — memory query
    'operator.paused',         // H3 Partner  — WorldClock.pause()
    'operator.resumed',        // H3 Partner  — WorldClock.resume()
    'operator.law_changed',    // H3 Partner  — LogosEngine add/amend/repeal
    'operator.telos_forced',   // H4 Driver   — hash-only diff, no goal contents
    // Phase 7 (DIALOG-02) — Nous-initiated telos refinement after peer dialogue.
    // Payload shape: { did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id }
    // Emitted ONLY via appendTelosRefined() (grid/src/audit/append-telos-refined.ts).
    'telos.refined',
    // Phase 8 (AGENCY-05) — H5 Sovereign Operations. Closed 5-key payload:
    // {tier: 'H5', action: 'delete', operator_id, target_did, pre_deletion_state_hash}.
    // Emitted ONLY via appendNousDeleted() (grid/src/audit/append-nous-deleted.ts).
    'operator.nous_deleted',
    // Phase 10a (DRIVE-03) — Ananke drive threshold crossings. Closed 5-key payload:
    // {did, tick, drive, level, direction}. level ∈ {low,med,high}; direction ∈ {rising,falling}.
    // Emitted ONLY via appendAnankeDriveCrossed() (grid/src/ananke/append-drive-crossed.ts).
    'ananke.drive_crossed',
    // Phase 10b (BIOS-02) — Bios birth boundary. Closed 3-key payload:
    // {did, psyche_hash, tick}. Emitted ONLY via appendBiosBirth()
    // (grid/src/bios/appendBiosBirth.ts).
    'bios.birth',
    // Phase 10b (BIOS-03) — Bios death boundary. Closed 4-key payload:
    // {cause, did, final_state_hash, tick}. cause ∈ {starvation, operator_h5, replay_boundary}.
    // Emitted ONLY via appendBiosDeath() (grid/src/bios/appendBiosDeath.ts).
    'bios.death',
    // Phase 11 (WHISPER-04) — Nous↔Nous envelope emission. Closed 4-key payload:
    // {ciphertext_hash, from_did, tick, to_did}. Sole producer
    // grid/src/whisper/appendNousWhispered.ts (lands in Wave 2). Per D-11-01 / CONTEXT-11.
    'nous.whispered',
    // Phase 12 (VOTE-01) — Governance proposal open. Closed 6-key payload:
    // {deadline_tick, proposal_id, proposer_did, quorum_pct, supermajority_pct, title_hash}.
    // Sole producer grid/src/governance/appendProposalOpened.ts (Wave 2). Per D-12-01 / CONTEXT-12.
    'proposal.opened',
    // Phase 12 (VOTE-02) — Blind ballot commit. Closed 3-key payload:
    // {commit_hash, proposal_id, voter_did}.
    // Sole producer grid/src/governance/appendBallotCommitted.ts (Wave 2). Per D-12-01 / CONTEXT-12.
    'ballot.committed',
    // Phase 12 (VOTE-03) — Ballot reveal. Closed 4-key payload:
    // {choice, nonce, proposal_id, voter_did}. choice ∈ {yes, no, abstain}.
    // Sole producer grid/src/governance/appendBallotRevealed.ts (Wave 2). Per D-12-01 / CONTEXT-12.
    'ballot.revealed',
    // Phase 12 (VOTE-04) — Proposal tally. Closed 6-key payload:
    // {abstain_count, no_count, outcome, proposal_id, quorum_met, yes_count}.
    // outcome ∈ {passed, rejected, quorum_fail}.
    // Sole producer grid/src/governance/appendProposalTallied.ts (Wave 2). Per D-12-01 / CONTEXT-12.
    'proposal.tallied',
    // Phase 13 — REPLAY-02 / D-13-09. Closed 6-tuple {tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}.
    // Sole producer grid/src/audit/append-operator-exported.ts. requested_at is Unix SECONDS (< 10_000_000_000).
    'operator.exported',
    // Phase 15 (REFLEX-02) — stub allowlist entries. Sole-producer emitters in grid/src/reflexion/.
    // Added as prerequisites per D-17-01 (Phase 15/16 were not separately executed).
    'nous.reflection_authored',  // (28) {nous_did, tick, reflection_hash}
    'nous.self_model_revised',   // (29) {nous_did, tick, revision_hash}
    'nous.creed_violation',      // (30) {nous_did, tick, creed_hash, violation_hash}
    // Phase 16 (SLEEP-01) — Nous sleep cycle boundaries. Closed 3-key payload:
    // {ltm_snapshot_hash, nous_did, tick} (alphabetical). Sole producers in grid/src/sleep/.
    // appendNousSleepEntered (grid/src/sleep/appendNousSleepEntered.ts)
    // appendNousSleepCompleted (grid/src/sleep/appendNousSleepCompleted.ts)
    'nous.sleep.entered',        // (31) {ltm_snapshot_hash, nous_did, tick}
    'nous.sleep.completed',      // (32) {ltm_snapshot_hash, nous_did, tick}
    // Phase 17 (IRIS-01..04 / D-17-02) — Theory of Mind lifecycle events.
    // All 4 carry hashes/counts only — belief content is Brain-private and NEVER crosses the wire.
    // Sole producers in grid/src/iris/append*.ts (D-17-08).
    'iris.belief_revised',         // (33) {nous_did, tick, target_did, belief_hash}
    'iris.context_invoked',        // (34) {nous_did, tick, belief_count}
    'iris.contradiction_detected', // (35) {nous_did, tick, target_did, contradiction_hash}
    'iris.prior_seeded',           // (36) {nous_did, tick, target_did, seed_event_hash}
    // Phase 18 (SKILL-03 / D-18-09) — Skill lifecycle events. Allowlist 36→39.
    // Brain metadata: see ActionType comments in brain/rpc/types.py. Grid injects learner_did + tick.
    // All 3 emitted ONLY via grid/src/skills/append*.ts sole-producer emitters (D-18-07/09).
    'skill.taught',    // (37) {learner_did, parent_hash, skill_hash, teacher_did, tick}
    'skill.inferred',  // (38) {learner_did, skill_hash, source_event_hash, tick}
    'skill.rejected',  // (39) {learner_did, rejection_reason, tick}; reason ∈ {low_trust, structural_invalid, quota_exceeded}
    // Assert: ALLOWLIST_MEMBERS.length === 39 before these two lines (D-19-11). Running total before Phase 25b additions: 45.
    // NormDetector observes nous.self_model_revised; fires when N≥3 Nous share fingerprint.
    // Both emitted ONLY via grid/src/norms/appendNormCandidate.ts and appendNormCrystallized.ts (D-19-06).
    'norm.candidate',    // (40) {convergence_type, fingerprint, participating_count, tick}
    'norm.crystallized', // (41) {convergence_type, evidence_tick_range, fingerprint, participating_count, tick}
    // Phase 20 (LORE-01..02 / D-20-12) — Lore commons lifecycle events. Allowlist 41→43.
    // Brain sends content_hash (+ category_tag for contributed); Grid injects contributor_did/citing_did + tick.
    // Emitted ONLY via grid/src/lore/appendLoreContributed.ts and appendLoreCited.ts (D-20-12).
    'lore.contributed', // (42) {category_tag, content_hash, contributor_did, tick}
    'lore.cited',       // (43) {citing_did, content_hash, tick}
    // Phase 22 (WEB3-04) — Human Portal first-connect event. Closed 4-key payload:
    // {human_did, eth_address_hash, grid_name, tick}. ETH address is SHA-256 hashed —
    // raw address NEVER crosses the wire. Emitted ONLY via appendHumanJoined()
    // (grid/src/audit/append-human-joined.ts). Per WEB3-04 / D-22-02.
    'human.joined',     // (44) {human_did, eth_address_hash, grid_name, tick}
    // Phase 23 gap / Phase 24 fix — Cyber Coin transfer notification. Closed 4-key payload:
    // {asset, grid_name, human_did, tick}. Recipient address and amount are NEVER stored.
    // Emitted ONLY via appendHumanTransferred() (grid/src/audit/append-human-transferred.ts).
    'human.transferred', // (45) {asset, grid_name, human_did, tick}
    // Phase 25b (SANCTION-01..06 / D-25b-07/08) — operator sanction events. Allowlist 45→51.
    // All 6 emitted ONLY via grid/src/audit/append-operator-*.ts sole-producer emitters (D-25b-09).
    // Reason plaintext NEVER crosses the wire — only reason_hash (HEX64_RE) per D-25b-11.
    'operator.muted',          // (46) {action, operator_id, reason_hash, target_did, tick, tier:'H3'}
    'operator.slashed',        // (47) {action, amount, operator_id, reason_hash, target_did, tick, tier:'H4'}
    'operator.quarantined',    // (48) {action, operator_id, reason_hash, target_did, tick, tier:'H4'}
    'operator.forced_sleep',   // (49) {action, operator_id, reason_hash, target_did, tick, tier:'H3'}
    'operator.human_banned',   // (50) {action, human_did, operator_id, reason_hash, tick, tier:'H5'}
    'operator.human_frozen',   // (51) {action, human_did, operator_id, reason_hash, tick, tier:'H5'}
    // Phase 27 (CHAT-04) — Human-to-Nous message audit. Closed 4-key payload:
    // {human_did, msg_hash, nous_did, tick}. Plain message text NEVER crosses the wire —
    // only sha256(plaintext). Emitted ONLY via appendHumanSpoke()
    // (grid/src/audit/append-human-spoke.ts). Running allowlist total: 52.
    'human.spoke',   // (52)
    // Phase 28 (SPAWN-04) — Personal Nous spawn by human. Closed 4-key payload:
    // {grid_name, nous_did, owner_human_did, tick}. Emitted ONLY via appendNousSpawnedByHuman()
    // (grid/src/audit/append-nous-spawned-by-human.ts). Running allowlist total: 53.
    'nous.spawned_by_human',   // (53)
    // Phase 33 (OBS-08, OBS-09, OBS-08b / D-33-A1, D-33-B1, D-33-B2) — Portal auth lifecycle events. Allowlist 53 to 56.
    // portal.auth.login: closed 3-key payload {human_did, method, tick} where method is 'siwe' or 'email'.
    // Emitted ONLY via appendPortalAuthLogin() (grid/src/audit/append-portal-auth-login.ts).
    // Fires on every SIWE verify success AND email signin success (unconditional, regardless of isNew).
    'portal.auth.login',    // (54) {human_did, method, tick}
    // portal.auth.register: closed 3-key payload {human_did, method, tick} where method is 'siwe' or 'email'.
    // Emitted ONLY via appendPortalAuthRegister() (grid/src/audit/append-portal-auth-register.ts).
    // Fires on SIWE first-connect (inside `if (!human)` block) AND email signup.
    'portal.auth.register', // (55) {human_did, method, tick}
    // human.identified: universal identity-stamp. Closed 5-key payload
    // {grid_name, human_did, identity_hash, identity_method, tick} where identity_method is 'siwe' or 'email'.
    // Emitted ONLY via appendHumanIdentified() (grid/src/audit/append-human-identified.ts).
    // SIWE path: identity_hash = sha256(ethAddress.toLowerCase()) — byte-identical to Phase 22 eth_address_hash
    // for correlation with pre-Phase-33 human.joined entries. Email path: identity_hash = sha256(email.toLowerCase().trim()).
    // Coexists with Phase 22 human.joined (SIWE-only birth event preserved per D-33-A7 + PHILOSOPHY §1).
    'human.identified',     // (56) {grid_name, human_did, identity_hash, identity_method, tick}
    // Phase 36 (VIS-05 / D-36-17) — Portal DID lifecycle + Grid recognition events. Allowlist 56 → 60.
    // portal.did_issued: closed 3-key {human_or_nous_did, issued_at_tick, issuer_portal_id}.
    //   Emitted ONLY via appendPortalDidIssued (grid/src/audit/append-portal-did-issued.ts).
    // portal.did_revoked: closed 3-key {human_or_nous_did, revoked_at_tick, revoker_portal_id}.
    //   Emitted ONLY via appendPortalDidRevoked (grid/src/audit/append-portal-did-revoked.ts).
    // grid.recognition_granted: closed 3-key {granted_at_tick, grid_name, nous_did}.
    //   Emitted ONLY via appendGridRecognitionGranted (grid/src/audit/append-grid-recognition-granted.ts).
    // grid.recognition_revoked: closed 3-key {grid_name, nous_did, revoked_at_tick}.
    //   Emitted ONLY via appendGridRecognitionRevoked (grid/src/audit/append-grid-recognition-revoked.ts).
    // NOTE: portal.notification_dispatched (D-36-19) is intentionally NOT here — private personal-queue event,
    // delivered via REST poll, not WS broadcast. See 36-VALIDATION.md Wave 0 Allowlist-Count Decision (60, NOT 61).
    'portal.did_issued',        // (57) {human_or_nous_did, issued_at_tick, issuer_portal_id}
    'portal.did_revoked',       // (58) {human_or_nous_did, revoked_at_tick, revoker_portal_id}
    'grid.recognition_granted', // (59) {granted_at_tick, grid_name, nous_did}
    'grid.recognition_revoked', // (60) {grid_name, nous_did, revoked_at_tick}
    // Phase 37 (REG-06) — DID Registry lifecycle events. Allowlist 60 → 64.
    // 'registry.civic_did_issued': closed 4-key {civic_did, existence_did, grid_name, issued_at_tick}.
    //   Emitted ONLY via appendRegistryCivicDidIssued (grid/src/audit/append-registry-civic-did-issued.ts).
    // 'registry.civic_did_revoked': closed 4-key {civic_did, court_conviction_ref_hash, grid_name, revoked_at_tick}.
    //   Emitted ONLY via appendRegistryCivicDidRevoked (grid/src/audit/append-registry-civic-did-revoked.ts).
    //   court_conviction_ref is HASHED in audit (HEX64); plaintext lives in civic_did_registry table only.
    // 'registry.business_did_registered': closed 4-key {business_did, civic_did, grid_name, registered_at_tick}.
    //   Emitted ONLY via appendRegistryBusinessDidRegistered (grid/src/audit/append-registry-business-did-registered.ts).
    //   business_name and category NOT in audit payload (privacy — business_did_registry table only).
    // 'registry.business_did_dissolved': closed 4-key {business_did, civic_did, dissolved_at_tick, grid_name}.
    //   Emitted ONLY via appendRegistryBusinessDidDissolved (grid/src/audit/append-registry-business-did-dissolved.ts).
    'registry.civic_did_issued',        // (61) {civic_did, existence_did, grid_name, issued_at_tick}
    'registry.civic_did_revoked',       // (62) {civic_did, court_conviction_ref_hash, grid_name, revoked_at_tick}
    'registry.business_did_registered', // (63) {business_did, civic_did, grid_name, registered_at_tick}
    'registry.business_did_dissolved',  // (64) {business_did, civic_did, dissolved_at_tick, grid_name}
] as const;

/**
 * Frozen read-only set. Consumers MUST NOT mutate this at runtime.
 * Dynamic allowlist toggling is deferred to Phase 4+ per 01-CONTEXT.md.
 *
 * Note: `Object.freeze` alone does NOT prevent `Set.prototype.add/delete/clear`
 * (they mutate internal slots, not properties). We override those three methods
 * to throw TypeError, then freeze the object so the overrides themselves cannot
 * be reassigned. Together this enforces immutability both at the type-system
 * level (ReadonlySet<string>) and at runtime.
 */
function buildFrozenAllowlist(members: readonly string[]): ReadonlySet<string> {
    const set = new Set(members);
    const throwFrozen = (): never => {
        throw new TypeError('ALLOWLIST is frozen; cannot mutate at runtime');
    };
    Object.defineProperty(set, 'add', { value: throwFrozen, writable: false, configurable: false });
    Object.defineProperty(set, 'delete', { value: throwFrozen, writable: false, configurable: false });
    Object.defineProperty(set, 'clear', { value: throwFrozen, writable: false, configurable: false });
    return Object.freeze(set) as ReadonlySet<string>;
}

export const ALLOWLIST: ReadonlySet<string> = buildFrozenAllowlist(ALLOWLIST_MEMBERS);

/** Default-deny membership check. */
export function isAllowlisted(eventType: string): boolean {
    return ALLOWLIST.has(eventType);
}

/**
 * Phase 10a (D-10a-07): drive-leaf keys that MUST NOT appear in any broadcast
 * payload. Numeric drive pressures are NEVER permitted across the Brain↔Grid↔
 * Dashboard wire. Only the closed-enum {drive, level, direction} triple crosses.
 */
export const DRIVE_FORBIDDEN_KEYS = [
    'hunger',
    'curiosity',
    'safety',
    'boredom',
    'loneliness',
    'drive_value',
] as const;

/**
 * Phase 10b (D-10b-10): bios-leaf keys that MUST NOT appear in any broadcast
 * payload. Numeric bios needs (energy / sustenance buffers, raw need values,
 * raw bios pressures) NEVER cross the wire. Only the closed-enum
 * {did, psyche_hash, tick} (birth) or {cause, did, final_state_hash, tick}
 * (death) crosses. Per CONTEXT.md D-10b-10 — exactly 4 keys. Do NOT add extras.
 */
export const BIOS_FORBIDDEN_KEYS = [
    'energy',
    'sustenance',
    'need_value',
    'bios_value',
] as const;

/**
 * Phase 10b (D-10b-10): chronos-leaf keys that MUST NOT appear in any broadcast
 * payload. Chronos is READ-SIDE ONLY (D-10b-11) — multipliers and subjective
 * tick translations are Brain-internal experience and never traverse the wire.
 * Per CONTEXT.md D-10b-10 — exactly 3 keys. Do NOT add extras.
 */
export const CHRONOS_FORBIDDEN_KEYS = [
    'subjective_multiplier',
    'chronos_multiplier',
    'subjective_tick',
] as const;

/**
 * Phase 12 (VOTE-06 / D-12-04 / D-12-11): governance-leaf keys that MUST NOT appear
 * in any governance payload. Proposal body text, plaintext vote contents, and
 * weight/reputation keys are permanently forbidden from all audit payloads.
 *
 * Source-of-truth: declared here, imported by grid/src/governance/types.ts.
 * Per D-12-11 — exactly 12 keys. Do NOT add extras without a CONTEXT.md decision.
 */
export const GOVERNANCE_FORBIDDEN_KEYS = Object.freeze([
    'text',
    'body',
    'content',
    'description',
    'rationale',
    'proposal_text',
    'law_text',
    'body_text',
    'weight',
    'reputation',
    'relationship_score',
    'ousia_weight',
] as const);

/**
 * Phase 17 (D-17-17): iris-leaf keys that MUST NOT appear in any iris payload.
 * Belief content, target text, emotion prose, dimension labels, and any iris
 * narrative is Brain-private and NEVER crosses the wire.
 * Only hashes (belief_hash, contradiction_hash, seed_event_hash) and counts
 * (belief_count) are permitted. Per D-17-17 — exactly 6 keys.
 */
export const IRIS_FORBIDDEN_KEYS = Object.freeze([
    'belief_content',
    'target_content',
    'emotion_text',
    'dimension_text',
    'belief_prose',
    'iris_content',
] as const);

/**
 * Phase 16 (HYP-04 / D-16-05): hypnos-leaf keys that MUST NOT appear in any
 * broadcast payload. LTM graph content, concept/node/edge text, episode text,
 * and raw graph data are Brain-private and NEVER cross the wire.
 * Only the closed 3-key tuple {ltm_snapshot_hash, nous_did, tick} crosses.
 * Per D-16-05 — exactly 6 keys. Do NOT add extras.
 */
export const HYPNOS_FORBIDDEN_KEYS = Object.freeze([
    'ltm_content',
    'concept_text',
    'graph_data',
    'episode_text',
    'node_content',
    'edge_content',
] as const);

/**
 * Phase 18 (D-18-08): skill-leaf keys that MUST NOT appear in any broadcast
 * payload. Skill body text, skill instructions, and rule text are Brain-private
 * and NEVER cross the Brain↔Grid wire. Only hashes (skill_hash, parent_hash,
 * source_event_hash) are permitted.
 * Per D-18-08 — exactly 3 keys. Do NOT add extras without a CONTEXT.md decision.
 */
export const SKILL_FORBIDDEN_KEYS = Object.freeze([
    'skill_body',
    'skill_text',
    'rule_text',
] as const);

/**
 * Phase 19 (NORM-01 / D-19-11): norm-leaf keys that MUST NOT appear in any
 * broadcast payload. Brain-private rule text, fingerprint source text, and raw
 * rule content NEVER cross the Brain↔Grid wire. Only the 6-char hex fingerprint
 * (revision_hash) is permitted — not the text it was derived from.
 * Per D-19-11 — exactly 3 keys. Do NOT add extras without a CONTEXT.md decision.
 */
export const NORM_FORBIDDEN_KEYS = Object.freeze([
    'norm_text',
    'fingerprint_text',
    'rule_content',
] as const);

/**
 * Phase 20 (LORE-01 / D-20-13): lore-leaf keys that MUST NOT appear in any
 * broadcast payload. Lore body text and title text are Brain-private and NEVER
 * cross the Brain↔Grid wire. Only content_hash (64-char hex) is permitted.
 * Per D-20-13 — exactly 4 keys. Do NOT add extras without a CONTEXT.md decision.
 *
 * NOTE: __lore_request: and __lore_response: are Brain-internal whisper prefixes;
 * they are never payload field names and are NOT added to WHISPER_FORBIDDEN_KEYS.
 * The Brain-side on_message() prefix check is the guard for lore plaintext. (RESEARCH.md §8)
 */
export const LORE_FORBIDDEN_KEYS = Object.freeze([
    'lore_body',
    'lore_content',
    'title_text',
    'summary_text',
] as const);

/**
 * Phase 11 (WHISPER-04 / D-11-09): whisper-leaf keys that MUST NOT appear in any
 * whisper payload. Plaintext whisper content (message bodies, utterances, offer
 * text, ousia amounts within whispers, raw decrypted data) NEVER crosses the wire.
 * Only the closed-enum {ciphertext_hash, from_did, tick, to_did} 4-tuple crosses.
 * Per D-11-09 — exactly 13 keys. Do NOT add extras.
 *
 * NOTE: offer, amount, ousia, price, value are NOT added to FORBIDDEN_KEY_PATTERN
 * because these keys are legitimately used in trade payloads (trade.proposed,
 * trade.settled). The whisper-specific plaintext gate uses WHISPER_FORBIDDEN_KEYS
 * directly in the whisper emitter boundary checks. The global FORBIDDEN_KEY_PATTERN
 * is extended only with the 8 whisper-only keys that have no legitimate use in
 * any other event payload type (text, body, content, message, utterance,
 * plaintext, decrypted, payload_plain).
 *
 * Phase 20: lore whispers use __lore_request: and __lore_response: Brain-internal
 * prefixes. These prefixes are NOT field names and are not in this array. See
 * RESEARCH.md §8 and D-20-13.
 */
export const WHISPER_FORBIDDEN_KEYS = Object.freeze([
    'text',
    'body',
    'content',
    'message',
    'utterance',
    'offer',
    'amount',
    'ousia',
    'price',
    'value',
    'plaintext',
    'decrypted',
    'payload_plain',
] as const);

// Phase 36 review (2026-05-25): all 5 new VIS-05 producer payloads reviewed; none contain forbidden keys. 13-key set preserved.
// Phase 37 review: all 4 new REG-06 producer payloads reviewed; none contain forbidden keys.
//   court_conviction_ref_hash is HEX64 hash only; business_name/category live in DB, not audit.
//   13-key PORTAL_AUTH_FORBIDDEN_KEYS preserved unchanged.
/**
 * Phase 33 (OBS-10 / D-33-B3): portal-auth-leaf keys that MUST NOT appear in any
 * portal.auth.* or human.identified payload. PII (IP, User-Agent, email plaintext,
 * session tokens, JWT, cookies, password, nonce, signature, device fingerprint)
 * is permanently forbidden from the audit chain.
 * Only hash representations (email_hash, identity_hash) are permitted — never plaintext.
 * Per D-33-B3 — exactly 13 keys. Do NOT add extras without a CONTEXT.md decision.
 *
 * Source-of-truth: declared here; referenced by Phase 33 producer files
 * (append-portal-auth-login.ts, append-portal-auth-register.ts, append-human-identified.ts)
 * via the global FORBIDDEN_KEY_PATTERN walker. The plaintext discipline is enforced at
 * the producer boundary by payloadPrivacyCheck(cleanPayload) before audit.append(...).
 */
export const PORTAL_AUTH_FORBIDDEN_KEYS = Object.freeze([
    'ip_address',
    'ip',
    'user_agent',
    'ua',
    'session_id',
    'token',
    'jwt',
    'cookie',
    'email',
    'password_hash',
    'nonce',
    'signature',
    'device_fingerprint',
] as const);

/**
 * Case-insensitive regex matching forbidden key substrings. Any payload
 * key that matches ANYWHERE (e.g., `user_prompt`, `Prompting`) is rejected.
 *
 * Phase 10a (D-10a-07): extended with the 6 DRIVE_FORBIDDEN_KEYS so numeric
 * drive pressures cannot leak via nested payloads.
 *
 * Phase 10b (D-10b-10): extended with the 4 BIOS_FORBIDDEN_KEYS + 3
 * CHRONOS_FORBIDDEN_KEYS so numeric bios needs and chronos multipliers
 * cannot leak via nested payloads. Prior Phase 6 keywords
 * (prompt|response|wiki|reflection|thought|emotion_delta) preserved verbatim.
 *
 * Phase 11 (D-11-09): extended with 8 whisper-only WHISPER_FORBIDDEN_KEYS
 * (text|body|content|message|utterance|plaintext|decrypted|payload_plain).
 * The 5 trade-compatible keys (offer|amount|ousia|price|value) from
 * WHISPER_FORBIDDEN_KEYS are NOT added here because they appear in legitimate
 * trade payloads — they are enforced only at the whisper emitter boundary.
 *
 * Phase 12 (D-12-04 / D-12-11): extended with 9 governance-only GOVERNANCE_FORBIDDEN_KEYS
 * not already present (description|rationale|proposal_text|law_text|body_text|
 * weight|reputation|relationship_score|ousia_weight). Keys text|body|content are
 * already present from Phase 11 — de-duped, not re-added.
 *
 * Phase 18 (D-18-08): extended with 3 SKILL_FORBIDDEN_KEYS (skill_body|skill_text|rule_text).
 * Skill body text, skill instructions, and rule text are Brain-private and NEVER cross
 * the Brain↔Grid wire. Only hashes (skill_hash, parent_hash, source_event_hash) are permitted.
 *
 * Phase 19 (NORM-01 / D-19-11): extended with 3 NORM_FORBIDDEN_KEYS (norm_text|fingerprint_text|rule_content).
 * Brain-private norm text and rule content NEVER cross the Brain↔Grid wire. Only the 6-char hex
 * fingerprint (revision_hash) is permitted — not the rule text it was derived from.
 *
 * Phase 20 (LORE-01 / D-20-13): extended with 4 LORE_FORBIDDEN_KEYS (lore_body|lore_content|title_text|summary_text).
 * Lore body text and title text are Brain-private and NEVER cross the Brain↔Grid wire. Only
 * content_hash (64-char hex) is permitted. Added before any lore emitter code lands.
 *
 * Phase 33 (OBS-10 / D-33-B4): extended with **word-boundary anchored** alternation
 * \b(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)\b
 * for the 6 multi-word / collision-risk keys in PORTAL_AUTH_FORBIDDEN_KEYS. This is
 * the FIRST use of \b...\b in this regex. Word boundaries are LOAD-BEARING:
 *   - email_hash is allowed (no email match because email is enforced at the closed-tuple boundary, not in this regex).
 *   - nonce_hash is allowed (same rationale — nonce isn't in this word-boundary clause).
 *   - ip_country is allowed (no ip_address match) while ip_address is forbidden.
 *   - agent_version is allowed (no user_agent match) while user_agent is forbidden.
 *
 * Note: `\b(?:user_agent)\b` does NOT match `user_agent_version` — JS regex `\b` does
 * not fire between word characters, and `_` is `\w`. Only the EXACT key `user_agent`
 * is forbidden by this clause. Compound forms like `user_agent_version` pass through
 * (and should be hashed or omitted by the caller if sensitive). Same applies to
 * `\bip_address\b`, `\bsession_id\b`, `\bjwt\b`, `\bpassword_hash\b`,
 * `\bdevice_fingerprint\b` — each matches only the exact key, never `<key>_<suffix>`.
 * Compound-form leakage is mitigated by the closed-tuple structural check at the
 * producer boundary (the 3-key / 5-key tuples have no slot for `user_agent_version`).
 *
 * The other 7 keys in PORTAL_AUTH_FORBIDDEN_KEYS (email, ip, ua, token, cookie,
 * nonce, signature) are NOT added to FORBIDDEN_KEY_PATTERN — they are short
 * common substrings that would over-match (e.g., signature substring inside
 * signatures_validated, email inside email_hash). They are enforced separately at the
 * producer boundary via the closed-tuple structural check (no payload may contain a key
 * literally named email because the closed 3-key tuple {human_did, method, tick} rejects it).
 */
export const FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value|energy|sustenance|need_value|bios_value|subjective_multiplier|chronos_multiplier|subjective_tick|text|body|content(?!_hash)|message|utterance|plaintext|decrypted|payload_plain|description|rationale|proposal_text|law_text|body_text|weight|reputation|relationship_score|ousia_weight|belief_content|target_content|emotion_text|dimension_text|belief_prose|iris_content|ltm_content|concept_text|graph_data|episode_text|node_content|edge_content|skill_body|skill_text|rule_text|norm_text|fingerprint_text|rule_content|lore_body|lore_content|title_text|summary_text|reflexion_text|creed_text|whisper_plaintext|\b(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)\b/i;

export interface PrivacyCheckResult {
    ok: boolean;
    /** Dotted key path (e.g. "meta.prompt" or "thought") identifying the first violation; undefined when ok=true. */
    offendingPath?: string;
    /** The matched forbidden keyword from FORBIDDEN_KEY_PATTERN; undefined when ok=true. */
    offendingKeyword?: string;
}

/**
 * Recursively walks `payload` (objects and arrays). Returns the FIRST
 * key-path whose key matches FORBIDDEN_KEY_PATTERN (case-insensitive).
 * This is intended for dev-mode assertion and for test suites enforcing
 * the sovereignty invariant at the AuditChain producer boundary.
 */
export function payloadPrivacyCheck(payload: unknown): PrivacyCheckResult {
    return walk(payload, '') ?? { ok: true };
}

function walk(node: unknown, path: string): PrivacyCheckResult | null {
    if (node === null || typeof node !== 'object') return null;

    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
            const childPath = path === '' ? String(i) : `${path}.${i}`;
            const r = walk(node[i], childPath);
            if (r) return r;
        }
        return null;
    }

    for (const key of Object.keys(node as Record<string, unknown>)) {
        const match = key.match(FORBIDDEN_KEY_PATTERN);
        const childPath = path === '' ? key : `${path}.${key}`;
        if (match) {
            return {
                ok: false,
                offendingPath: childPath,
                offendingKeyword: match[0].toLowerCase(),
            };
        }
        const r = walk((node as Record<string, unknown>)[key], childPath);
        if (r) return r;
    }
    return null;
}
