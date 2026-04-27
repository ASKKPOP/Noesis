/**
 * Shared vitest setup — runs before every test file.
 * Registers @testing-library/jest-dom matchers and auto-cleans the DOM.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

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
