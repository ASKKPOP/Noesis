/**
 * Phase 37 / REG-02 — W3C VC v2.0 builder for Civic-DID and Business-DID credentials.
 *
 * Uses the Grid's existing ES256 key pair (keyPairPromise) for signing.
 * Produces JsonWebSignature2020 compact JWS proofs.
 *
 * W3C VC Data Model v2.0 Recommendation (2025-05-15):
 *   https://www.w3.org/TR/vc-data-model-2.0/
 *
 * IMPORTANT: uses validFrom (v2.0 field). The v1.x deprecated field is NOT used.
 */

import { CompactSign } from 'jose';
import { keyPairPromise } from '../api/portal/auth.js';
import { randomUUID } from 'node:crypto';

export const GRID_REGISTRY_DID = 'did:grid:noesis:genesis-registry';

/**
 * Build a W3C VC v2.0 Civic-DID credential with JWS proof.
 */
export async function buildCivicDidVc(params: {
    civicDid: string;
    existenceDid: string;
    issuedAtTick: number;
}): Promise<object> {
    const { privateKey } = await keyPairPromise;
    const vcId = `urn:noesis:vc:${randomUUID()}`;
    const validFrom = new Date().toISOString();

    const vcBody = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: vcId,
        type: ['VerifiableCredential', 'CivicDIDCredential'],
        issuer: GRID_REGISTRY_DID,
        validFrom,   // W3C VC v2.0 field (Recommendation 2025-05-15)
        credentialSubject: {
            id: params.civicDid,
            existenceDid: params.existenceDid,
            civicRole: 'resident',
            issuedAtTick: params.issuedAtTick,
        },
        credentialStatus: {
            id: `${GRID_REGISTRY_DID}/status/${params.civicDid}`,
            type: 'RegistryStatus',
            registryEndpoint: `/api/v1/registry/civic-did/${params.civicDid}`,
        },
    };

    const jws = await new CompactSign(
        new TextEncoder().encode(JSON.stringify(vcBody)),
    )
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

    return { ...vcBody, proof: { type: 'JsonWebSignature2020', jws } };
}

/**
 * Build a W3C VC v2.0 Business-DID credential with JWS proof.
 */
export async function buildBusinessDidVc(params: {
    businessDid: string;
    civicDid: string;
    businessName: string;
    category: string;
    issuedAtTick: number;
}): Promise<object> {
    const { privateKey } = await keyPairPromise;
    const vcId = `urn:noesis:vc:${randomUUID()}`;
    const validFrom = new Date().toISOString();

    const vcBody = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: vcId,
        type: ['VerifiableCredential', 'BusinessDIDCredential'],
        issuer: GRID_REGISTRY_DID,
        validFrom,   // W3C VC v2.0 field (Recommendation 2025-05-15)
        credentialSubject: {
            id: params.businessDid,
            ownerCivicDid: params.civicDid,
            businessName: params.businessName,
            category: params.category,
            issuedAtTick: params.issuedAtTick,
        },
        credentialStatus: {
            id: `${GRID_REGISTRY_DID}/status/${params.businessDid}`,
            type: 'RegistryStatus',
            registryEndpoint: `/api/v1/registry/business-did/${params.businessDid}`,
        },
    };

    const jws = await new CompactSign(
        new TextEncoder().encode(JSON.stringify(vcBody)),
    )
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

    return { ...vcBody, proof: { type: 'JsonWebSignature2020', jws } };
}
