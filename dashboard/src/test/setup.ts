/**
 * Shared vitest setup — runs before every test file.
 * Registers @testing-library/jest-dom matchers and auto-cleans the DOM.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import Module from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

// Plan 07 Rule 3 fix: patch Module._resolveFilename + register .tsx/.ts CJS
// extension loaders so that require('./foo.js') resolves and loads ./foo.tsx.
// This enables the metadata export assertion in page.test.tsx:
//   require('./page.js').metadata?.title → resolves + loads page.tsx
//
// We use TypeScript's transpileModule() which runs in the current V8 context
// and does NOT rely on esbuild's binary (which fails in jsdom due to the
// TextEncoder shim replacing globalThis.TextEncoder with a jsdom mock,
// causing esbuild's "new TextEncoder().encode('') instanceof Uint8Array" invariant
// to fail).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ts = require('typescript') as typeof import('typescript');

{
    type ModuleType = typeof Module & {
        _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
        _extensions: Record<string, (m: NodeModule, filename: string) => void>;
    };
    const Mod = Module as unknown as ModuleType;

    // 1. Register .tsx and .ts extension loaders using TypeScript's transpileModule.
    function compileTsFile(m: NodeModule, filename: string): void {
        const src = fs.readFileSync(filename, 'utf8');
        const result = ts.transpileModule(src, {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                jsx: ts.JsxEmit.ReactJSX,
                jsxImportSource: 'react',
                target: ts.ScriptTarget.ES2018,
                esModuleInterop: true,
            },
            fileName: filename,
        });
        (m as unknown as { _compile: (code: string, filename: string) => void })._compile(result.outputText, filename);
    }
    Mod._extensions['.tsx'] = compileTsFile;
    Mod._extensions['.ts'] = compileTsFile;

    // 2. Patch Module._resolveFilename to map ./foo.js → ./foo.tsx / ./foo.ts
    //    when the .js file doesn't exist on disk.
    const orig = Mod._resolveFilename;
    Mod._resolveFilename = function (request, parent, isMain, options) {
        if (
            typeof request === 'string' &&
            request.startsWith('.') &&
            request.endsWith('.js')
        ) {
            const parentFile = (parent as { filename?: string } | null)?.filename;
            const dir = parentFile ? path.dirname(parentFile) : process.cwd();
            const base = path.resolve(dir, request.slice(0, -3));
            for (const ext of ['.tsx', '.ts']) {
                if (fs.existsSync(base + ext)) return base + ext;
            }
        }
        return orig.call(this, request, parent, isMain, options);
    };
}

// Phase 13 (Plan 13-05): DataTransfer + ClipboardEvent shims for jsdom — jsdom
// does not expose DataTransfer or ClipboardEvent globally. Tests that simulate
// paste events via `new ClipboardEvent` require both shims.
// (Rule 3 auto-fix — environment missing required globals.)
if (typeof DataTransfer === 'undefined') {
    class DataTransferShim {
        private _data: Map<string, string> = new Map();
        getData(format: string): string { return this._data.get(format) ?? ''; }
        setData(format: string, data: string): void { this._data.set(format, data); }
        clearData(format?: string): void {
            if (format) this._data.delete(format);
            else this._data.clear();
        }
        get types(): string[] { return Array.from(this._data.keys()); }
        readonly files: FileList = [] as unknown as FileList;
        readonly items = [] as unknown as DataTransferItemList;
        effectAllowed: DataTransfer['effectAllowed'] = 'none';
        dropEffect: DataTransfer['dropEffect'] = 'none';
    }
    (globalThis as unknown as { DataTransfer: typeof DataTransferShim }).DataTransfer =
        DataTransferShim;
}

if (typeof ClipboardEvent === 'undefined') {
    class ClipboardEventShim extends Event {
        clipboardData: DataTransfer | null;
        constructor(type: string, eventInitDict?: ClipboardEventInit) {
            super(type, eventInitDict);
            this.clipboardData = eventInitDict?.clipboardData ?? null;
        }
    }
    (globalThis as unknown as { ClipboardEvent: typeof ClipboardEventShim }).ClipboardEvent =
        ClipboardEventShim;
}

afterEach(() => {
    cleanup();
});
