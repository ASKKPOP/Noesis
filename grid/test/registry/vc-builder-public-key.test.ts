import { describe, it } from 'vitest';

// buildCivicDidVc — Phase 42 Plan 02
// existencePublicKeyJwk is a new optional param added to credentialSubject
// so Brain can include its Ed25519 public key in the Civic-DID VC for P2P peer discovery.

describe('buildCivicDidVc public key (Phase 42 Plan 02)', () => {
    it.skip('buildCivicDidVc with existencePublicKeyJwk param includes it in credentialSubject', () => {
        // const jwk = { kty: 'OKP', crv: 'Ed25519', x: 'base64urlvalue' };
        // const vc = buildCivicDidVc({ civicDid: 'did:civic:noesis:abc', existencePublicKeyJwk: jwk, ... });
        // expect(vc.credentialSubject.existencePublicKeyJwk).toEqual(jwk);
    });

    it.skip('buildCivicDidVc with existencePublicKeyJwk: null OMITS key from credentialSubject (backward compat)', () => {
        // const vc = buildCivicDidVc({ civicDid: 'did:civic:noesis:abc', existencePublicKeyJwk: null, ... });
        // expect(vc.credentialSubject).not.toHaveProperty('existencePublicKeyJwk');
    });

    it.skip('buildCivicDidVc with valid OKP JWK {kty:"OKP",crv:"Ed25519",x:"base64url"} preserves structure exactly', () => {
        // const jwk = { kty: 'OKP', crv: 'Ed25519', x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' };
        // const vc = buildCivicDidVc({ civicDid: 'did:civic:noesis:abc', existencePublicKeyJwk: jwk, ... });
        // expect(vc.credentialSubject.existencePublicKeyJwk).toStrictEqual(jwk);
    });

    it.skip('existing call sites passing only original params still work (param is optional, backward compat)', () => {
        // // No existencePublicKeyJwk passed — should not throw
        // expect(() => buildCivicDidVc({ civicDid: 'did:civic:noesis:abc', ... })).not.toThrow();
        // const vc = buildCivicDidVc({ civicDid: 'did:civic:noesis:abc', ... });
        // expect(vc.credentialSubject).not.toHaveProperty('existencePublicKeyJwk');
    });
});
