/**
 * Phase 37 — vc-builder unit tests.
 *
 * Verifies W3C VC v2.0 shape: validFrom (NOT issuanceDate), JWS proof, credential fields.
 */

import { describe, it, expect } from 'vitest';
import { buildCivicDidVc, buildBusinessDidVc, GRID_REGISTRY_DID } from '../../src/civic-registry/vc-builder.js';

describe('buildCivicDidVc', () => {
    it('resolves with @context pointing to W3C VC v2.0 namespace', async () => {
        const vc = await buildCivicDidVc({
            civicDid: 'did:civic:noesis:test-001',
            existenceDid: 'did:noesis:nous:abc',
            issuedAtTick: 42,
        }) as Record<string, unknown>;

        expect((vc['@context'] as string[])[0]).toBe('https://www.w3.org/ns/credentials/v2');
    });

    it('has VerifiableCredential and CivicDIDCredential types', async () => {
        const vc = await buildCivicDidVc({
            civicDid: 'did:civic:noesis:test-001',
            existenceDid: 'did:noesis:nous:abc',
            issuedAtTick: 42,
        }) as Record<string, unknown>;

        const type = vc['type'] as string[];
        expect(type[0]).toBe('VerifiableCredential');
        expect(type[1]).toBe('CivicDIDCredential');
    });

    it('issuer is the grid registry DID', async () => {
        const vc = await buildCivicDidVc({
            civicDid: 'did:civic:noesis:test-001',
            existenceDid: 'did:noesis:nous:abc',
            issuedAtTick: 42,
        }) as Record<string, unknown>;

        expect(vc['issuer']).toBe(GRID_REGISTRY_DID);
        expect(vc['issuer']).toBe('did:grid:noesis:genesis-registry');
    });

    it('has validFrom (ISO 8601) and NO issuanceDate', async () => {
        const vc = await buildCivicDidVc({
            civicDid: 'did:civic:noesis:test-001',
            existenceDid: 'did:noesis:nous:abc',
            issuedAtTick: 42,
        }) as Record<string, unknown>;

        expect(vc['validFrom']).toBeDefined();
        expect(typeof vc['validFrom']).toBe('string');
        expect(vc['validFrom'] as string).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        // W3C VC v2.0: issuanceDate is deprecated — must NOT be present
        expect(Object.keys(vc)).not.toContain('issuanceDate');
    });

    it('id starts with urn:noesis:vc:', async () => {
        const vc = await buildCivicDidVc({
            civicDid: 'did:civic:noesis:test-001',
            existenceDid: 'did:noesis:nous:abc',
            issuedAtTick: 42,
        }) as Record<string, unknown>;

        expect(typeof vc['id']).toBe('string');
        expect(vc['id'] as string).toMatch(/^urn:noesis:vc:/);
    });

    it('credentialSubject has correct fields', async () => {
        const vc = await buildCivicDidVc({
            civicDid: 'did:civic:noesis:test-001',
            existenceDid: 'did:noesis:nous:abc',
            issuedAtTick: 42,
        }) as Record<string, unknown>;

        const cs = vc['credentialSubject'] as Record<string, unknown>;
        expect(cs['id']).toBe('did:civic:noesis:test-001');
        expect(cs['existenceDid']).toBe('did:noesis:nous:abc');
        expect(cs['civicRole']).toBe('resident');
        expect(cs['issuedAtTick']).toBe(42);
    });

    it('proof.type is JsonWebSignature2020 and proof.jws is compact JWS', async () => {
        const vc = await buildCivicDidVc({
            civicDid: 'did:civic:noesis:test-001',
            existenceDid: 'did:noesis:nous:abc',
            issuedAtTick: 42,
        }) as Record<string, unknown>;

        const proof = vc['proof'] as Record<string, unknown>;
        expect(proof['type']).toBe('JsonWebSignature2020');
        expect(typeof proof['jws']).toBe('string');
        // Compact JWS = header.payload.signature (3 base64url segments, 2 dots)
        const dots = (proof['jws'] as string).split('.').length - 1;
        expect(dots).toBe(2);
    });
});

describe('buildBusinessDidVc', () => {
    it('resolves with @context pointing to W3C VC v2.0 namespace', async () => {
        const vc = await buildBusinessDidVc({
            businessDid: 'did:biz:noesis:b001',
            civicDid: 'did:civic:noesis:test-001',
            businessName: 'Acme',
            category: 'retail',
            issuedAtTick: 100,
        }) as Record<string, unknown>;

        expect((vc['@context'] as string[])[0]).toBe('https://www.w3.org/ns/credentials/v2');
    });

    it('has VerifiableCredential and BusinessDIDCredential types', async () => {
        const vc = await buildBusinessDidVc({
            businessDid: 'did:biz:noesis:b001',
            civicDid: 'did:civic:noesis:test-001',
            businessName: 'Acme',
            category: 'retail',
            issuedAtTick: 100,
        }) as Record<string, unknown>;

        const type = vc['type'] as string[];
        expect(type[0]).toBe('VerifiableCredential');
        expect(type[1]).toBe('BusinessDIDCredential');
    });

    it('has validFrom (ISO 8601) and NO issuanceDate', async () => {
        const vc = await buildBusinessDidVc({
            businessDid: 'did:biz:noesis:b001',
            civicDid: 'did:civic:noesis:test-001',
            businessName: 'Acme',
            category: 'retail',
            issuedAtTick: 100,
        }) as Record<string, unknown>;

        expect(vc['validFrom']).toBeDefined();
        expect(vc['validFrom'] as string).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(Object.keys(vc)).not.toContain('issuanceDate');
    });

    it('id starts with urn:noesis:vc:', async () => {
        const vc = await buildBusinessDidVc({
            businessDid: 'did:biz:noesis:b001',
            civicDid: 'did:civic:noesis:test-001',
            businessName: 'Acme',
            category: 'retail',
            issuedAtTick: 100,
        }) as Record<string, unknown>;

        expect(vc['id'] as string).toMatch(/^urn:noesis:vc:/);
    });

    it('credentialSubject has correct fields for Business-DID', async () => {
        const vc = await buildBusinessDidVc({
            businessDid: 'did:biz:noesis:b001',
            civicDid: 'did:civic:noesis:test-001',
            businessName: 'Acme',
            category: 'retail',
            issuedAtTick: 100,
        }) as Record<string, unknown>;

        const cs = vc['credentialSubject'] as Record<string, unknown>;
        expect(cs['id']).toBe('did:biz:noesis:b001');
        expect(cs['ownerCivicDid']).toBe('did:civic:noesis:test-001');
        expect(cs['businessName']).toBe('Acme');
        expect(cs['category']).toBe('retail');
        expect(cs['issuedAtTick']).toBe(100);
    });

    it('credentialStatus registryEndpoint points to business-did path', async () => {
        const vc = await buildBusinessDidVc({
            businessDid: 'did:biz:noesis:b001',
            civicDid: 'did:civic:noesis:test-001',
            businessName: 'Acme',
            category: 'retail',
            issuedAtTick: 100,
        }) as Record<string, unknown>;

        const cs = vc['credentialStatus'] as Record<string, unknown>;
        expect(cs['registryEndpoint']).toBe('/api/v1/registry/business-did/did:biz:noesis:b001');
    });

    it('proof.jws is compact JWS (2 dots)', async () => {
        const vc = await buildBusinessDidVc({
            businessDid: 'did:biz:noesis:b001',
            civicDid: 'did:civic:noesis:test-001',
            businessName: 'Acme',
            category: 'retail',
            issuedAtTick: 100,
        }) as Record<string, unknown>;

        const proof = vc['proof'] as Record<string, unknown>;
        expect(proof['type']).toBe('JsonWebSignature2020');
        const dots = (proof['jws'] as string).split('.').length - 1;
        expect(dots).toBe(2);
    });
});
