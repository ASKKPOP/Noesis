import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Ensure libsodium-wrappers is fully ready before any test file is
        // collected. See test/setup-sodium.ts for the rationale (crypto helpers
        // are invoked at describe-body / collection time in some suites).
        setupFiles: ['./test/setup-sodium.ts'],
    },
});
