'use client';

/**
 * Portal home page — loaded client-only (ssr:false) because it uses
 * wagmi hooks which require WagmiProvider, itself client-only.
 */

import dynamic from 'next/dynamic';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';
import { useAccount } from 'wagmi';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-neutral-100">{value}</p>
            {sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>}
        </div>
    );
}

function ComingSoonCard({ title, description, phase }: { title: string; description: string; phase: string }) {
    return (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 opacity-60">
            <div className="flex items-start justify-between">
                <p className="text-sm font-semibold text-neutral-200">{title}</p>
                <span className="rounded bg-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
                    {phase}
                </span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">{description}</p>
        </div>
    );
}

function PortalHome() {
    const { currentUser } = useHumanAuthStore();
    const { address } = useAccount();

    const shortDid = currentUser?.did
        ? `did:noesis:human:${currentUser.did.split(':').pop()?.slice(0, 10)}…`
        : '—';

    return (
        <div className="p-8">
            {/* Sign-in banner — shown when wallet not connected */}
            {!address && (
                <div className="mb-6 flex items-center justify-between rounded-xl border border-violet-800/40 bg-violet-950/30 px-5 py-4">
                    <div>
                        <p className="text-sm font-semibold text-violet-200">Connect your wallet to unlock the portal</p>
                        <p className="mt-0.5 text-xs text-violet-400">Sign in with Ethereum to access your identity, wallet, and Nous.</p>
                    </div>
                    <a
                        href="/portal/auth"
                        className="ml-4 shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
                    >
                        Sign In
                    </a>
                </div>
            )}

            {/* Welcome */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-neutral-100">Welcome to Noēsis</h1>
                <p className="mt-1 text-sm text-neutral-400">
                    Your gateway to the Genesis Grid — observe, interact, and shape the world.
                </p>
            </div>

            {/* Identity */}
            <section className="mb-8">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Your Identity</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard label="DID" value={shortDid} sub="did:noesis:human" />
                    <StatCard
                        label="Wallet"
                        value={address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'}
                        sub="EIP-55 checksummed"
                    />
                    <StatCard label="Agency Tier" value="H1" sub="Observe only" />
                </div>
            </section>

            {/* Coming soon features */}
            <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Coming Soon</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <ComingSoonCard
                        title="Cyber Coin Wallet"
                        description="View your ETH and USDT balances, send and receive Cyber Coin, and track transaction history."
                        phase="Phase 23"
                    />
                    <ComingSoonCard
                        title="Chat with Nous"
                        description="Talk to Sophia, Hermes, and Themis. Send tips, browse their activity feed, and explore their skills."
                        phase="Phase 26"
                    />
                    <ComingSoonCard
                        title="My Nous"
                        description="Spawn your own Nous agent, name it, choose personality seeds, and watch it live in the Genesis Grid."
                        phase="Phase 27"
                    />
                    <ComingSoonCard
                        title="Community"
                        description="Browse the user directory, post on the community board, follow others, and climb the leaderboard."
                        phase="Phase 28"
                    />
                    <ComingSoonCard
                        title="Help & Resources"
                        description="Interactive guide, FAQ, Noēsis glossary, and support ticket flow."
                        phase="Phase 29"
                    />
                </div>
            </section>
        </div>
    );
}

export default dynamic(() => Promise.resolve({ default: PortalHome }), { ssr: false });
