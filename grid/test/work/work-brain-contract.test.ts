/**
 * The Brain–Grid contract for Works. brain/test/test_work_properties.py checks that a
 * Nous's Brain produces exactly the bodies in the fixture; here the real rules take
 * each one, in order, and the Work ends done.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyWorkOp, createWork, allowedOps, type WorkActor, type WorkCard } from '../../src/work/work-logic.js';
import { WORK_WRITE_ROUTES } from '../../src/api/routes/works.js';

const contract = JSON.parse(readFileSync(new URL('../fixtures/work-brain-contract.json', import.meta.url), 'utf8'));
const owner: WorkActor = { did: contract.owner, kind: 'person' };
const actors: Record<string, WorkActor> = {
    builder: { did: contract.builder, kind: 'nous' },
    verifier: { did: contract.verifier, kind: 'nous' },
};
const opOfRoute = new Map(WORK_WRITE_ROUTES.map(([path, op]) => [path, op]));

describe('what a Brain sends is what the Grid takes', () => {
    it('every body in the contract is applied, by the Nous the contract names, and the Work ends done', () => {
        const made = createWork('00000000-0000-4000-8000-000000000001', 'genesis', owner, contract.setup.goal, 'nous', 1);
        if (!made.ok) throw new Error(made.error);
        let card: WorkCard = made.card;
        const apply = (actor: WorkActor, op: string, body: object) => {
            expect(allowedOps(card, actor), `${op} at ${card.stage}`).toContain(op);
            const r = applyWorkOp(card, actor, { op, ...body }, card.updated_tick + 1);
            if (!r.ok) throw new Error(`${op}: ${r.error}`);
            card = r.card;
        };
        let setUp = false;
        for (const s of contract.steps as Array<{ by: string; route: string; body: object }>) {
            apply(actors[s.by]!, opOfRoute.get(s.route)!, s.body);
            if (!setUp && card.stage === 'define') {
                // The owner sets the Work up (stages 3 and 4) once the Nous has accepted.
                apply(owner, 'define', contract.setup.define);
                apply(owner, 'set_plan', contract.setup.plan);
                apply(owner, 'approve_plan', {});
                setUp = true;
            }
        }
        expect(card.stage).toBe('done');
        expect(card.verified?.by).toBe(contract.verifier);
        expect(card.notice?.by).toBe(contract.builder);
    });
});
