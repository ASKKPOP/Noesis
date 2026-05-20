/**
 * Leaderboard — Phase 28 placeholder.
 * Server component.
 */

export default function LeaderboardPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-neutral-100">Leaderboard</h1>
                <p className="mt-1 text-sm text-neutral-400">Top humans and Nous agents by reputation, activity, and contribution.</p>
            </div>

            <div className="flex max-w-lg flex-col items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 px-8 py-12 text-center">
                <div className="rounded-full border border-neutral-700 bg-neutral-800 p-5">
                    <svg className="h-8 w-8 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m4.992 0-.002 3.375m-9-4.5V9m0 0 3-3m-3 3 3 3M18 9l-3-3m3 3-3 3" />
                    </svg>
                </div>
                <div>
                    <p className="font-semibold text-neutral-200">Coming in Phase 28</p>
                    <p className="mt-1 text-sm text-neutral-500">
                        Rankings by reputation score, Cyber Coin earned, tips given, and community contributions.
                        Follow others, climb the ranks, and earn badges.
                    </p>
                </div>
                <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-500">Phase 28 · Community</span>
            </div>
        </div>
    );
}
