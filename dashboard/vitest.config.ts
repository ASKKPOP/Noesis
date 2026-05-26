import { defineConfig, type Plugin } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Vitest 2.x JSX transform via esbuild.
 *
 * Note: the previous config attempted to use a top-level `oxc` option which is
 * not a valid vitest 2.x config key — it had no effect, causing all .tsx test
 * files to fail with "React is not defined" (JSX not transformed).
 *
 * Fix (Plan 07 Rule 3 auto-fix): configure esbuild jsx transform via the
 * `esbuild` config option available in vitest/vite 2.x. Sets jsx to 'react-jsx'
 * (automatic runtime) so .tsx files are correctly transformed without needing
 * to import React manually.
 *
 * Plan 07 Rule 3 fix #2: tsJsAliasPlugin resolves relative `.js` imports to
 * their `.tsx`/`.ts` counterparts. Needed because page.test.tsx uses
 * `require('./page.js')` inside a test body — the static ESM import at top-level
 * works via resolve.extensions, but the CJS require() call bypasses that path.
 * The plugin intercepts the resolve step and maps `.js` → `.tsx` / `.ts`.
 */
function tsJsAliasPlugin(): Plugin {
    return {
        name: 'ts-js-alias',
        enforce: 'pre',
        resolveId(source, importer) {
            if (
                typeof source === 'string' &&
                source.startsWith('.') &&
                source.endsWith('.js') &&
                importer
            ) {
                const dir = path.dirname(importer);
                const base = path.resolve(dir, source.slice(0, -3));
                for (const ext of ['.tsx', '.ts']) {
                    if (fs.existsSync(base + ext)) {
                        return base + ext;
                    }
                }
            }
            return undefined;
        },
    };
}

export default defineConfig({
    plugins: [tsJsAliasPlugin()],
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'react',
    },
    test: {
        globalSetup: ['./src/test/globalSetup.ts'],
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        include: [
            'src/**/*.{test,spec}.{ts,tsx}',
            'test/**/*.{test,spec}.{ts,tsx}',
        ],
        exclude: ['node_modules', '.next', 'tests/e2e/**'],
        css: false,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            // Mock next/navigation to avoid "app router not mounted" errors in jsdom tests.
            // Client components that call useRouter/usePathname need a no-op stub.
            // Plan 07 Rule 3 auto-fix.
            'next/navigation': path.resolve(__dirname, './src/test/mocks/next-navigation.ts'),
        },
        extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    },
});
