/**
 * Tests for GET /api/v1/grid/culture/skills/lineage
 * Plan 21-02 Wave 1 — TDD
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../audit/chain.js';
import { registerCultureRoutes } from '../api/routes/culture.js';

function makeAuditChain(): AuditChain {
    return new AuditChain();
}

async function buildApp(audit: AuditChain) {
    const app = Fastify({ logger: false });
    await registerCultureRoutes(app, audit);
    await app.ready();
    return app;
}

describe('GET /api/v1/grid/culture/skills/lineage', () => {
    let audit: AuditChain;

    beforeEach(() => {
        audit = makeAuditChain();
    });

    it('returns { nodes: [], edges: [] } when audit chain has no skill events', async () => {
        const app = await buildApp(audit);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/grid/culture/skills/lineage',
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as { nodes: unknown[]; edges: unknown[] };
        expect(body.nodes).toEqual([]);
        expect(body.edges).toEqual([]);
        await app.close();
    });

    it('returns nous node for each unique teacher_did from skill.taught events', async () => {
        audit.append('skill.taught', 'did:noesis:alpha', {
            teacher_did: 'did:noesis:alpha',
            learner_did: 'did:noesis:beta',
            skill_hash: 'sha256:abc123',
            parent_hash: null,
            tick: 42,
        });
        const app = await buildApp(audit);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/grid/culture/skills/lineage',
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as { nodes: Array<{ id: string; type: string }> };
        const nousNode = body.nodes.find((n) => n.id === 'did:noesis:alpha');
        expect(nousNode).toBeDefined();
        expect(nousNode!.type).toBe('nous');
        await app.close();
    });

    it('returns skill node for each unique skill_hash from skill events', async () => {
        audit.append('skill.taught', 'did:noesis:alpha', {
            teacher_did: 'did:noesis:alpha',
            learner_did: 'did:noesis:beta',
            skill_hash: 'sha256:abc123',
            parent_hash: null,
            tick: 42,
        });
        const app = await buildApp(audit);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/grid/culture/skills/lineage',
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as { nodes: Array<{ id: string; type: string; label: string }> };
        const skillNode = body.nodes.find((n) => n.id === 'sha256:abc123');
        expect(skillNode).toBeDefined();
        expect(skillNode!.type).toBe('skill');
        expect(skillNode!.label).toBe('sha256');
        await app.close();
    });

    it('returns taught edge for skill.taught events with type="taught"', async () => {
        audit.append('skill.taught', 'did:noesis:alpha', {
            teacher_did: 'did:noesis:alpha',
            learner_did: 'did:noesis:beta',
            skill_hash: 'sha256:abc123',
            parent_hash: null,
            tick: 42,
        });
        const app = await buildApp(audit);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/grid/culture/skills/lineage',
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as {
            edges: Array<{ source: string; target: string; tick: number; type: string }>;
        };
        expect(body.edges).toHaveLength(1);
        const edge = body.edges[0];
        expect(edge.source).toBe('did:noesis:alpha');
        expect(edge.target).toBe('sha256:abc123');
        expect(edge.tick).toBe(42);
        expect(edge.type).toBe('taught');
        await app.close();
    });

    it('returns inferred edge for skill.inferred events with type="inferred"', async () => {
        audit.append('skill.inferred', 'did:noesis:gamma', {
            learner_did: 'did:noesis:gamma',
            skill_hash: 'sha256:def456',
            source_event_hash: 'hash',
            tick: 67,
        });
        const app = await buildApp(audit);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/grid/culture/skills/lineage',
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as {
            edges: Array<{ source: string; target: string; tick: number; type: string }>;
        };
        expect(body.edges).toHaveLength(1);
        const edge = body.edges[0];
        expect(edge.source).toBe('sha256:def456');
        expect(edge.target).toBe('did:noesis:gamma');
        expect(edge.tick).toBe(67);
        expect(edge.type).toBe('inferred');
        await app.close();
    });

    it('returns x and y numeric positions for every node', async () => {
        audit.append('skill.taught', 'did:noesis:alpha', {
            teacher_did: 'did:noesis:alpha',
            learner_did: 'did:noesis:beta',
            skill_hash: 'sha256:abc123',
            parent_hash: null,
            tick: 42,
        });
        const app = await buildApp(audit);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/grid/culture/skills/lineage',
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as {
            nodes: Array<{ x: unknown; y: unknown }>;
        };
        for (const node of body.nodes) {
            expect(typeof node.x).toBe('number');
            expect(typeof node.y).toBe('number');
        }
        await app.close();
    });

    it('root nodes (Nous with no incoming edges) are at depth 0', async () => {
        audit.append('skill.taught', 'did:noesis:alpha', {
            teacher_did: 'did:noesis:alpha',
            learner_did: 'did:noesis:beta',
            skill_hash: 'sha256:abc123',
            parent_hash: null,
            tick: 42,
        });
        const app = await buildApp(audit);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/grid/culture/skills/lineage',
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as {
            nodes: Array<{ id: string; y: number }>;
        };
        const alphaNous = body.nodes.find((n) => n.id === 'did:noesis:alpha');
        expect(alphaNous).toBeDefined();
        // Root nodes at depth 0 should have the smallest y value
        const minY = Math.min(...body.nodes.map((n) => n.y));
        expect(alphaNous!.y).toBe(minY);
        await app.close();
    });

    it('nodes at deeper depths have larger y coordinate (monotonic)', async () => {
        // teacher_did -> skill_hash is the edge; teacher is root (depth 0), skill is depth 1
        audit.append('skill.taught', 'did:noesis:alpha', {
            teacher_did: 'did:noesis:alpha',
            learner_did: 'did:noesis:beta',
            skill_hash: 'sha256:abc123',
            parent_hash: null,
            tick: 42,
        });
        const app = await buildApp(audit);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/grid/culture/skills/lineage',
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as {
            nodes: Array<{ id: string; y: number }>;
        };
        const alpha = body.nodes.find((n) => n.id === 'did:noesis:alpha');
        const skill = body.nodes.find((n) => n.id === 'sha256:abc123');
        expect(alpha).toBeDefined();
        expect(skill).toBeDefined();
        // Root (alpha) should have smaller y than child (skill)
        expect(alpha!.y).toBeLessThan(skill!.y);
        await app.close();
    });
});
