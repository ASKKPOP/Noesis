import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import fs from 'node:fs';

/**
 * JSX transform.
 *
 * History: under vitest 2.x the JSX transform was configured via the top-level
 * `esbuild: { jsx: 'automatic' }` option. The project later upgraded to vitest
 * 4.x (rolldown-vite), which ignores that esbuild option — so all .tsx test
 * files began failing to parse JSX ("Unexpected JSX expression"), 49/78 suites.
 *
 * Fix (2026-06-13): use `@vitejs/plugin-react-swc`, NOT `@vitejs/plugin-react`.
 *
 * Why plugin-react does NOT work here:
 *   - plugin-react@4.x in its automatic-runtime path does not transform JSX
 *     itself; it configures `esbuild: { jsx: 'automatic' }` and delegates the
 *     actual JSX stripping to vite's built-in oxc transform (rolldown-vite
 *     converts esbuild.jsx -> oxc.jsx). Its own `transform` hook only adds
 *     react-refresh, and is even deleted when fast-refresh is skipped (SSR).
 *   - Vitest 4's config hook (vitest/dist/chunks/cli-api...js) REPLACES the
 *     resolved `oxc` option with `{ target: viteConfig.oxc?.target || 'node18' }`
 *     — it drops `oxc.jsx` entirely. So the built-in oxc transform never gets a
 *     JSX runtime, JSX reaches rolldown's `parseAstAsync` in `ssrTransform`
 *     untransformed, and parsing dies with "Unexpected JSX expression".
 *   This is why adding `@vitejs/plugin-react`'s `react()` changed nothing.
 *
 * Why plugin-react-swc works:
 *   - It transforms JSX/TS in its own `transform` hook via @swc/core, fully
 *     independent of vite's oxc/esbuild pipeline. Vitest's oxc.jsx stripping is
 *     irrelevant — SWC has already produced plain JS before parseAst runs.
 *   - It declares peer `vite ^4 || ... || ^8`, so it supports the bundled
 *     rolldown-vite 8.x that vitest 4.1 ships (plugin-react@4.7 caps at ^7).
 *
 *
 * tsJsAliasPlugin resolves relative `.js` imports to
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
    plugins: [react(), tsJsAliasPlugin()],
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
