import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest 4.1 bundles Vite 8, which ships its own `oxc` JSX transform. The
 * older `@vitejs/plugin-react@4.7` plugin still passes esbuild-shaped JSX
 * options, which Vite 8 ignores (see the "oxc options will be used" warning
 * it prints). Rather than pull in an experimental plugin-react-oxc variant,
 * we configure Vite's native oxc JSX transform directly — it handles .tsx
 * via the automatic runtime with `jsxImportSource: 'react'`.
 *
 * No HMR / react-refresh is needed because this config serves Vitest only
 * (tests run to completion, not a dev server).
 */
export default defineConfig({
    test: {
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
    oxc: {
        jsx: {
            runtime: 'automatic',
            importSource: 'react',
        },
    },
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
    },
});
