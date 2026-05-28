import { describe, it, expect } from 'vitest';
import { buildCivicDidVc } from '../../src/civic-registry/vc-builder.js';

// buildCivicDidVc — Phase 42 Plan 02
// existencePublicKeyJwk is a new optional param added to credentialSubject
// so Brain can include its Ed25519 public key in the Civic-DID VC for P2P peer discovery.

describe('buildCivicDidVc public key (Phase 42 Plan 02)', () => {
    const BASE_PARAMS = {
        civicDid: 'did:civic:noesis:test-abc',
        existenceDid: 'did:noesis:nous:test-abc',
        issuedAtTick: 1,
    };

    it('buildCivicDidVc with existencePublicKeyJwk param includes it in credentialSubject', async () => {
        const jwk = { kty: 'OKP', crv: 'Ed25519', x: 'base64urlvalue' };
        const vc = await buildCivicDidVc({ ...BASE_PARAMS, existencePublicKeyJwk: jwk }) as any;
        expect(vc.credentialSubject.existencePublicKeyJwk).toEqual(jwk);
    });

    it('buildCivicDidVc with existencePublicKeyJwk: null OMITS key from credentialSubject (backward compat)', async () => {
        const vc = await buildCivicDidVc({ ...BASE_PARAMS, existencePublicKeyJwk: null }) as any;
        expect(vc.credentialSubject).not.toHaveProperty('existencePublicKeyJwk');
    });

    it('buildCivicDidVc with valid OKP JWK {kty:"OKP",crv:"Ed25519",x:"base64url"} preserves structure exactly', async () => {
        const jwk = { kty: 'OKP', crv: 'Ed25519', x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' };
        const vc = await buildCivicDidVc({ ...BASE_PARAMS, existencePublicKeyJwk: jwk }) as any;
        expect(vc.credentialSubject.existencePublicKeyJwk).toStrictEqual(jwk);
    });

    it('existing call sites passing only original params still work (param is optional, backward compat)', async () => {
        const vc = await buildCivicDidVc(BASE_PARAMS) as any;
        expect(vc.credentialSubject).not.toHaveProperty('existencePublicKeyJwk');
    });
});
