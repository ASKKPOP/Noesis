/**
 * Portal home page — the entry point for human users.
 *
 * Phase 22: Shows ConnectWalletButton; authenticated users will be
 * redirected to their feed in later phases.
 */

import { ConnectWalletButton } from '@/components/portal/ConnectWalletButton';

export default function PortalPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-neutral-100">Noēsis Portal</h1>
                <p className="mt-2 text-neutral-400">Connect your wallet to enter</p>
            </div>
            <ConnectWalletButton />
        </main>
    );
}
