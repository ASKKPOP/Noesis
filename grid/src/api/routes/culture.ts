/**
 * Culture Dashboard REST endpoint — Phase 21 D-21-03.
 * GET /api/v1/grid/culture/skills/lineage
 * Response: { nodes: LineageNode[], edges: LineageEdge[] }
 *
 * Queries audit chain for skill.taught and skill.inferred events,
 * computes BFS hierarchical layout server-side (D-9-08 / D-21-03),
 * and returns {nodes, edges} ready for client SVG rendering.
 */
import type { FastifyInstance } from 'fastify';
import type { AuditChain } from '../../audit/chain.js';

interface LineageNode {
    id: string;
    label: string;
    type: 'nous' | 'skill';
    x: number;
    y: number;
}

interface LineageEdge {
    source: string;
    target: string;
    tick: number;
    type: 'taught' | 'inferred';
}

const VIEWPORT = { width: 1000, height: 1000 } as const;

/**
 * Returns the last segment of a DID string (e.g., "sophia" from "did:noesis:sophia").
 * For skill hashes or other strings, returns the string itself if no ':' found.
 */
function lastDIDSegment(did: string): string {
    return did.split(':').pop() ?? did;
}

/**
 * Computes BFS hierarchical layout positions for nodes given edges.
 * - Roots: nodes that never appear as an edge target
 * - BFS from all roots simultaneously assigns depth to each node
 * - x = (indexInGroup + 1) / (groupSize + 1) * VIEWPORT.width
 * - y = depth === 0 ? 50 : depth * (VIEWPORT.height / (maxDepth + 1))
 * - Isolated nodes (unreachable from BFS) get depth = 0
 */
function computeBFSLayout(
    nodeIds: string[],
    edges: Array<{ source: string; target: string }>,
): Map<string, { x: number; y: number }> {
    // Build adjacency list (source → targets)
    const adjacency = new Map<string, string[]>();
    const incomingTargets = new Set<string>();

    for (const nodeId of nodeIds) {
        adjacency.set(nodeId, []);
    }

    for (const edge of edges) {
        const neighbors = adjacency.get(edge.source);
        if (neighbors) {
            neighbors.push(edge.target);
        }
        incomingTargets.add(edge.target);
    }

    // Roots: nodes that never appear as an edge target
    const roots = nodeIds.filter((id) => !incomingTargets.has(id));

    // BFS depth assignment
    const depthMap = new Map<string, number>();
    const queue: string[] = [];

    for (const root of roots) {
        depthMap.set(root, 0);
        queue.push(root);
    }

    let head = 0;
    while (head < queue.length) {
        const current = queue[head++];
        const currentDepth = depthMap.get(current) ?? 0;
        const neighbors = adjacency.get(current) ?? [];
        for (const neighbor of neighbors) {
            if (!depthMap.has(neighbor)) {
                depthMap.set(neighbor, currentDepth + 1);
                queue.push(neighbor);
            }
        }
    }

    // Isolated nodes (not reached by BFS) get depth 0
    for (const nodeId of nodeIds) {
        if (!depthMap.has(nodeId)) {
            depthMap.set(nodeId, 0);
        }
    }

    // Find max depth
    let maxDepth = 0;
    for (const depth of depthMap.values()) {
        if (depth > maxDepth) maxDepth = depth;
    }

    // Group nodes by depth
    const depthGroups = new Map<number, string[]>();
    for (const [nodeId, depth] of depthMap.entries()) {
        if (!depthGroups.has(depth)) {
            depthGroups.set(depth, []);
        }
        depthGroups.get(depth)!.push(nodeId);
    }

    // Compute x, y positions
    const positionMap = new Map<string, { x: number; y: number }>();
    const levelHeight = maxDepth === 0 ? VIEWPORT.height : VIEWPORT.height / (maxDepth + 1);

    for (const [depth, group] of depthGroups.entries()) {
        const groupSize = group.length;
        const y = depth === 0 ? 50 : depth * levelHeight;
        for (let i = 0; i < groupSize; i++) {
            const x = ((i + 1) / (groupSize + 1)) * VIEWPORT.width;
            positionMap.set(group[i], { x, y });
        }
    }

    return positionMap;
}

export async function registerCultureRoutes(
    fastify: FastifyInstance,
    audit: AuditChain,
): Promise<void> {
    fastify.get('/api/v1/grid/culture/skills/lineage', async (request, reply) => {
        try {
            const entries = audit
                .all()
                .filter(
                    (e) => e.eventType === 'skill.taught' || e.eventType === 'skill.inferred',
                );

            // Empty state: return immediately without layout computation
            if (entries.length === 0) {
                return reply.code(200).send({ nodes: [], edges: [] });
            }

            // Build node and edge sets from entries
            const nodeMap = new Map<string, Omit<LineageNode, 'x' | 'y'>>();
            const edges: LineageEdge[] = [];

            for (const entry of entries) {
                if (entry.eventType === 'skill.taught') {
                    const p = entry.payload as {
                        teacher_did: string;
                        skill_hash: string;
                        learner_did: string;
                        tick: number;
                        parent_hash?: string | null;
                    };

                    // Nous node for teacher
                    if (!nodeMap.has(p.teacher_did)) {
                        nodeMap.set(p.teacher_did, {
                            id: p.teacher_did,
                            label: lastDIDSegment(p.teacher_did),
                            type: 'nous',
                        });
                    }

                    // Skill node
                    if (!nodeMap.has(p.skill_hash)) {
                        nodeMap.set(p.skill_hash, {
                            id: p.skill_hash,
                            label: p.skill_hash.slice(0, 6),
                            type: 'skill',
                        });
                    }

                    // Taught edge: teacher → skill
                    edges.push({
                        source: p.teacher_did,
                        target: p.skill_hash,
                        tick: p.tick,
                        type: 'taught',
                    });
                } else if (entry.eventType === 'skill.inferred') {
                    const p = entry.payload as {
                        learner_did: string;
                        skill_hash: string;
                        source_event_hash: string;
                        tick: number;
                    };

                    // Skill node (source of inference)
                    if (!nodeMap.has(p.skill_hash)) {
                        nodeMap.set(p.skill_hash, {
                            id: p.skill_hash,
                            label: p.skill_hash.slice(0, 6),
                            type: 'skill',
                        });
                    }

                    // Nous node for learner
                    if (!nodeMap.has(p.learner_did)) {
                        nodeMap.set(p.learner_did, {
                            id: p.learner_did,
                            label: lastDIDSegment(p.learner_did),
                            type: 'nous',
                        });
                    }

                    // Inferred edge: skill → learner
                    edges.push({
                        source: p.skill_hash,
                        target: p.learner_did,
                        tick: p.tick,
                        type: 'inferred',
                    });
                }
            }

            // Compute BFS hierarchical layout
            const nodeIds = Array.from(nodeMap.keys());
            const positionMap = computeBFSLayout(nodeIds, edges);

            // Assemble final nodes with positions
            const nodes: LineageNode[] = nodeIds.map((id) => {
                const base = nodeMap.get(id)!;
                const pos = positionMap.get(id) ?? { x: 0, y: 0 };
                return { ...base, x: pos.x, y: pos.y };
            });

            return reply.code(200).send({ nodes, edges });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            request.log.error({ msg: 'lineage_query_failed', err: msg });
            return reply.code(500).send({ error: 'lineage query failed' });
        }
    });
}
