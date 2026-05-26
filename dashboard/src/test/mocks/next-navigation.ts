/**
 * Vitest mock for next/navigation — provides no-op implementations of
 * useRouter, usePathname, useSearchParams, etc. so that client components
 * that use these hooks can render in the jsdom test environment without
 * requiring a mounted Next.js App Router.
 *
 * Wired via resolve.alias in vitest.config.ts.
 *
 * Plan 07 Rule 3 auto-fix: CivicMap uses useRouter() which throws
 * "invariant expected app router to be mounted" in jsdom tests.
 */
import { vi } from 'vitest';

export const useRouter = vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
}));

export const usePathname = vi.fn(() => '/');

export const useSearchParams = vi.fn(() => new URLSearchParams());

export const useParams = vi.fn(() => ({}));

export const redirect = vi.fn();

export const notFound = vi.fn();
