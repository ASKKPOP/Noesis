/**
 * Vitest globalSetup — runs in the main Node process (NOT inside jsdom).
 * Registers .tsx/.ts CJS require hooks so that require('./foo.js') in tests
 * can resolve and compile TypeScript/JSX source files.
 *
 * This runs once before all test workers start. The module patches apply to
 * the main process; test workers (jsdom) inherit the patched Module state.
 *
 * Plan 07 Rule 3 fix: enables page.test.tsx's `require('./page.js')` to load
 * page.tsx (metadata export assertion).
 */

import Module from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

// Use vite's bundled esbuild (runs before jsdom, so TextEncoder is real Node.js impl)
import { transformSync } from 'esbuild';

export function setup(): void {
    // Register TypeScript/JSX compiler for Node's require()
    const extensions = (Module as unknown as { _extensions: Record<string, (m: NodeModule, filename: string) => void> })._extensions;

    function compileTsFile(m: NodeModule, filename: string): void {
        const src = fs.readFileSync(filename, 'utf8');
        const loader = filename.endsWith('.tsx') ? 'tsx' : 'ts';
        const { code } = transformSync(src, {
            loader,
            format: 'cjs',
            jsx: 'automatic',
            jsxImportSource: 'react',
            target: 'node18',
            // Suppress unused import warnings (react/jsx-runtime may not be used in metadata-only path)
            logLevel: 'silent',
        });
        (m as unknown as { _compile: (code: string, filename: string) => void })._compile(code, filename);
    }

    extensions['.tsx'] = compileTsFile;
    extensions['.ts'] = compileTsFile;

    // Patch Module._resolveFilename to map ./foo.js → ./foo.tsx/.foo.ts
    const origResolve = (Module as unknown as { _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string })._resolveFilename;
    (Module as unknown as { _resolveFilename: typeof origResolve })._resolveFilename = function (request, parent, isMain, options) {
        if (typeof request === 'string' && request.startsWith('.') && request.endsWith('.js')) {
            const parentFile = (parent as { filename?: string } | null)?.filename;
            const dir = parentFile ? path.dirname(parentFile) : process.cwd();
            const base = path.resolve(dir, request.slice(0, -3));
            for (const ext of ['.tsx', '.ts']) {
                if (fs.existsSync(base + ext)) return base + ext;
            }
        }
        return origResolve.call(this, request, parent, isMain, options);
    };
}
