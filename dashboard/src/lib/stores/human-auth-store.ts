/**
 * Human auth store — session state for the authenticated portal user.
 *
 * Phase 22 WEB3-03: holds the HumanUser returned after SIWE verification.
 * Cleared on logout or wallet disconnect.
 */

import { create } from 'zustand';
import type { HumanUser } from '@/lib/web3/siwe-auth';

interface HumanAuthState {
    /** Currently authenticated human user, or null if not signed in. */
    currentUser: HumanUser | null;
    setUser: (user: HumanUser) => void;
    clearUser: () => void;
}

export const useHumanAuthStore = create<HumanAuthState>((set) => ({
    currentUser: null,
    setUser: (user) => set({ currentUser: user }),
    clearUser: () => set({ currentUser: null }),
}));
