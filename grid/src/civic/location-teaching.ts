/**
 * Phase 61 HOUSE-4 (D-61-04 / R-61-06) — location-aware teaching (structures become schools).
 *
 * A skill (a blueprint or otherwise) taught inside a `workshop` structure diffuses to the Nous
 * PRESENT in that structure — the Phase 58 in-memory occupant map (presence, not property). A
 * workshop becomes a school. This REUSES the EXISTING Phase 18 diffusion verbatim: teachHere
 * only SELECTS the learner set (the present occupants) and calls `appendSkillTaught` per learner.
 *
 * The `skill.taught` 5-tuple {learner_did, parent_hash, skill_hash, teacher_did, tick} is
 * UNCHANGED — `parcel_id` is a GRID-SIDE selector, NEVER a payload key (off the chain). Humans
 * present (did:civic:noesis:human:*) are NEVER learners (VOTE-05 / D-NH-07). Request-driven —
 * no clock.onTick (single-onTick).
 */

import type { AuditChain } from '../audit/chain.js';
import type { ParcelRegistry } from './parcel-registry.js';
import { isHumanDid } from './roles.js';
import { appendSkillTaught } from '../skills/appendSkillTaught.js';

/**
 * Deps for teachHere:
 *  - `registry` is the Phase 58 occupant-map surface (the present-Nous set the selector reads)
 *     + the structure-type read (a workshop becomes a school).
 *  - `teach` wraps the EXISTING `appendSkillTaught` producer — one skill.taught per learner, the
 *     5-tuple UNCHANGED. When omitted, a default is synthesized from `audit` (the same producer).
 *  - `audit` is the chain the default `teach` appends to (used when `teach` is not given).
 */
export interface TeachHereDeps {
    registry: ParcelRegistry;
    teach?: (learnerDid: string, skill_hash: string, parent_hash: string, teacherDid: string, tick: number) => void;
    audit?: AuditChain;
}

/**
 * Teach a skill HERE — diffuse it to the Nous present in the parcel's workshop (D-61-04):
 *   1. read the present-occupant set for `parcel_id` (Phase 58 occupant map), restricted to a
 *      `workshop` structure (a workshop becomes a school; a non-workshop diffuses to no one).
 *   2. exclude the teacher + any did:civic:noesis:human:* (humans are never learners).
 *   3. for each remaining present Nous, call the EXISTING appendSkillTaught producer (the
 *      skill.taught 5-tuple is unchanged; `parcel_id` is the SELECTOR only, never a payload key).
 *   4. return the list of learner DIDs taught.
 */
export function teachHere(
    parcel_id: string,
    teacherDid: string,
    skill_hash: string,
    parent_hash: string,
    tick: number,
    deps: TeachHereDeps,
): string[] {
    // The default teach wraps appendSkillTaught — learner self-reports (learner_did === actorDid),
    // the existing 5-tuple unchanged, parcel_id NEVER a payload key (Grid-side selector only).
    const teach =
        deps.teach ??
        ((learnerDid: string, sh: string, ph: string, td: string, t: number) => {
            if (!deps.audit) return; // no producer wired — selection-only call
            appendSkillTaught(deps.audit, learnerDid, {
                learner_did: learnerDid,
                parent_hash: ph,
                skill_hash: sh,
                teacher_did: td,
                tick: t,
            });
        });

    // 1. The location selector only applies inside a workshop (a workshop becomes a school).
    const structure = deps.registry.get(parcel_id)?.structure;
    if (!structure || structure.type !== 'workshop') return [];

    // 2. Present occupants minus the teacher minus any present human.
    const present = deps.registry.occupants(parcel_id);
    const learners = present.filter((did) => did !== teacherDid && !isHumanDid(did));

    // 3. Diffuse via the EXISTING producer — one skill.taught per present learner.
    for (const learnerDid of learners) {
        teach(learnerDid, skill_hash, parent_hash, teacherDid, tick);
    }
    // 4. Return the taught learner DIDs.
    return learners;
}
