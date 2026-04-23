/** Phase 10b Grid-side Bios audit surface — BIOS-02, BIOS-03, BIOS-04. */
export { appendBiosBirth, DID_RE, HEX64_RE } from './appendBiosBirth.js';
export { appendBiosDeath, type TombstoneCheck } from './appendBiosDeath.js';
export {
    BIOS_BIRTH_KEYS,
    BIOS_DEATH_KEYS,
    CAUSE_VALUES,
    assertCause,
} from './types.js';
export type { BiosBirthPayload, BiosDeathPayload, BiosDeathCause } from './types.js';
