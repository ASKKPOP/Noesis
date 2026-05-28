import { defineConfig } from 'vitest/config';
import path from 'node:path';

// WR-03: esbuild jsx config works with vitest v2.x (currently installed: ^2.1.0).
// If upgrading to vitest v4+, replace the esbuild block with:
//   plugins: [(await import('@vitejs/plugin-react')).default()]
// and add @vitejs/plugin-react to devDependencies.
export default defineConfig({
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'react',
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        css: false,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    },
});
