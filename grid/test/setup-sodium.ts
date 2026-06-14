/**
 * Vitest setup file — ensures libsodium-wrappers is fully initialized before any
 * test file is collected.
 *
 * libsodium-wrappers attaches its crypto_* functions to the module object only
 * after its `ready` promise resolves (a microtask after `require`/import). Some
 * test suites (e.g. whisper-crypto, whisper-keyring) call crypto helpers at
 * `describe`-body level, which vitest evaluates during the collection phase —
 * before any `beforeAll` runs. Without this setup that code runs before sodium
 * is ready and fails with "crypto_box_seed_keypair is not a function".
 *
 * Setup files are awaited before test modules are imported, so awaiting
 * initSodium() here guarantees the captured-ready sodium reference is populated
 * by the time any describe body executes. This does not change crypto behavior.
 */
import { initSodium } from '../src/whisper/crypto.js';

await initSodium();
