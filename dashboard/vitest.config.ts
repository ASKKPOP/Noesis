import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest 4.x + Vite 8 (bundled rolldown/oxc): configure JSX via the native
 * oxc option instead of @vitejs/plugin-react (which targets Vite 4-7 / babel).
 *
 * Vite 8 uses OXC for transforms. Setting `oxc.jsx` to automatic enables React
 * JSX transform without any external plugin. This replaces the previous
 * @vitejs/plugin-react approach which is incompatible with Vite 8's oxc pipeline.
 *
 * @vitejs/plugin-react is kept in devDependencies for IDE tooling / Next.js
 * next.config usage, but is NOT loaded in this vitest config.
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
        },
    },
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
    },
});
