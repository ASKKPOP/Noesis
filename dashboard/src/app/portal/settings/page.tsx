/**
 * Settings — Phase 31 placeholder.
 * Server component.
 */

const SETTING_GROUPS = [
    {
        title: 'Appearance',
        items: ['Theme (Dark / Light / Cyber)', 'Language', 'Timezone display'],
    },
    {
        title: 'Notifications',
        items: ['Nous activity alerts', 'Wallet transaction notifications', 'Community mentions', 'Governance vote reminders'],
    },
    {
        title: 'Privacy',
        items: ['Profile visibility', 'Activity log retention', 'Data export (GDPR)'],
    },
    {
        title: 'Security',
        items: ['Active sessions', 'Revoke portal access', 'Trusted wallets'],
    },
    {
        title: 'Developer',
        items: ['API key management', 'Webhook endpoints', 'Rate limit dashboard'],
    },
];

export default function SettingsPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-neutral-100">Settings</h1>
                <p className="mt-1 text-sm text-neutral-400">Portal preferences, privacy controls, and developer options.</p>
            </div>

            <div className="mb-8 flex items-center gap-3 rounded-xl border border-neutral-800/50 bg-neutral-900/30 px-5 py-3">
                <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">Phase 31</span>
                <p className="text-xs text-neutral-500">Full settings panel coming in a future release.</p>
            </div>

            <div className="max-w-lg space-y-6">
                {SETTING_GROUPS.map(group => (
                    <div key={group.title}>
                        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-600">{group.title}</h2>
                        <div className="overflow-hidden rounded-xl border border-neutral-800">
                            {group.items.map((item, i) => (
                                <div
                                    key={item}
                                    className={[
                                        'flex items-center justify-between px-5 py-3 opacity-40',
                                        i < group.items.length - 1 ? 'border-b border-neutral-800' : '',
                                    ].join(' ')}
                                >
                                    <span className="text-sm text-neutral-300">{item}</span>
                                    <div className="h-4 w-16 rounded bg-neutral-800" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
