import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// HTMLDialogElement shim — jsdom 26 has partial <dialog> support but showModal/close
// are not fully implemented. This shim patches the prototype to allow testing.
if (typeof HTMLDialogElement !== 'undefined') {
    const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
        showModal: () => void;
        close: () => void;
    };
    if (!proto.showModal || proto.showModal.toString().includes('[native code]') === false) {
        proto.showModal = function (this: HTMLDialogElement) {
            (this as unknown as { open: boolean }).open = true;
        };
    }
    if (!proto.close || proto.close.toString().includes('[native code]') === false) {
        proto.close = function (this: HTMLDialogElement) {
            (this as unknown as { open: boolean }).open = false;
            this.dispatchEvent(new Event('close'));
        };
    }
    // Patch showModal unconditionally (jsdom showModal doesn't set .open)
    proto.showModal = function (this: HTMLDialogElement) {
        (this as unknown as { open: boolean }).open = true;
    };
    proto.close = function (this: HTMLDialogElement) {
        (this as unknown as { open: boolean }).open = false;
        this.dispatchEvent(new Event('close'));
    };
}

// jsdom does not expose DataTransfer globally — needed for ClipboardEvent paste tests
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
    (globalThis as unknown as { DataTransfer: typeof DataTransferShim }).DataTransfer = DataTransferShim;
}

if (typeof ClipboardEvent === 'undefined') {
    class ClipboardEventShim extends Event {
        clipboardData: DataTransfer | null;
        constructor(type: string, eventInitDict?: ClipboardEventInit) {
            super(type, eventInitDict);
            this.clipboardData = eventInitDict?.clipboardData ?? null;
        }
    }
    (globalThis as unknown as { ClipboardEvent: typeof ClipboardEventShim }).ClipboardEvent = ClipboardEventShim;
}

afterEach(() => { cleanup(); });
