import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Vitest 2.x + Vite 5: use @vitejs/plugin-react for JSX automatic runtime
 * transform. The `oxc` key is Vite 8 syntax and is ignored on Vite 5.
 *
 * No HMR / react-refresh is needed because this config serves Vitest only
 * (tests run to completion, not a dev server).
 */
export default defineConfig({
    plugins: [react()],
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
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
    },
});
