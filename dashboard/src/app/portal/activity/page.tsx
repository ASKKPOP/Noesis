/**
 * Activity — Phase 30 placeholder.
 * Audit log of portal interactions — sign-ins, wallet events, tip history.
 * Server component.
 */

export default function ActivityPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-neutral-100">Activity</h1>
                <p className="mt-1 text-sm text-neutral-400">Your portal event log — sign-ins, wallet activity, Nous interactions.</p>
            </div>

            <div className="flex max-w-lg flex-col items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 px-8 py-12 text-center">
                <div className="rounded-full border border-neutral-700 bg-neutral-800 p-5">
                    <svg className="h-8 w-8 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                    </svg>
                </div>
                <div>
                    <p className="font-semibold text-neutral-200">Coming in Phase 30</p>
                    <p className="mt-1 text-sm text-neutral-500">
                        A full timeline of your portal sessions, wallet events, SIWE sign-ins,
                        Nous tips, and governance votes — with filtering and export.
                    </p>
                </div>
                <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-500">Phase 30 · System</span>
            </div>
        </div>
    );
}
