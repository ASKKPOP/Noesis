/**
 * Shared vitest setup — runs before every test file.
 * Registers @testing-library/jest-dom matchers and auto-cleans the DOM.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
    cleanup();
});
