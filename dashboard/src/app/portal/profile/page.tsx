'use client';

/**
 * Portal profile page — loaded client-only (ssr:false) because it uses wagmi hooks.
 */

import dynamic from 'next/dynamic';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';
import { useAccount, useDisconnect } from 'wagmi';

function ProfilePage() {
    const { currentUser, clearUser } = useHumanAuthStore();
    const { address, chain } = useAccount();
    const { disconnect } = useDisconnect();

    function handleSignOut() {
        clearUser();
        disconnect();
        document.cookie = 'noesis_portal_token=; Max-Age=0; path=/';
        window.location.href = '/portal/auth';
    }

    const rows: { label: string; value: string }[] = [
        { label: 'DID', value: currentUser?.did ?? '—' },
        { label: 'Ethereum Address', value: currentUser?.eth_address ?? address ?? '—' },
        { label: 'Network', value: chain?.name ?? '—' },
        { label: 'Agency Tier', value: 'H1 — Observe only' },
    ];

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-neutral-100">Profile</h1>
                <p className="mt-1 text-sm text-neutral-400">Your on-chain identity in the Noēsis Portal.</p>
            </div>

            <div className="max-w-lg">
                <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
                    <dl>
                        {rows.map(({ label, value }, i) => (
                            <div
                                key={label}
                                className={[
                                    'flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-4',
                                    i < rows.length - 1 ? 'border-b border-neutral-800' : '',
                                ].join(' ')}
                            >
                                <dt className="w-36 shrink-0 text-xs font-medium uppercase tracking-wider text-neutral-500">
                                    {label}
                                </dt>
                                <dd className="break-all font-mono text-sm text-neutral-200">{value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <div className="mt-6">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:border-red-700 hover:text-red-300"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                        </svg>
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}

export default dynamic(() => Promise.resolve({ default: ProfilePage }), { ssr: false });
