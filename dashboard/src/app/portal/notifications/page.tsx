/**
 * Notifications page.
 * Server component: requires portal session. Anonymous visitors see a sign-in stub.
 * Authenticated visitors see their notification list with read/unread state.
 */
import { resolveVisitorTier } from '../../../lib/visitor-tier';
import { cookies } from 'next/headers';
import { safeGridFetch } from '@/lib/server-grid-fetch';

const PORTAL_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface Notification {
    id: string;
    type: string;
    message: string;
    read: boolean;
    created_at: string;
}

interface NotificationsResponse {
    notifications: Notification[];
}

export default async function NotificationsPage() {
    const { tier } = await resolveVisitorTier();

    // Anonymous visitors: sign-in stub — skip fetch
    if (tier === 'anonymous') {
        return (
            <main className="bg-[#0a0a0c] min-h-screen px-8 py-8 max-w-[960px] mx-auto">
                <h1 className="text-xl font-semibold text-[#e8e8ec] mb-4">Notifications</h1>
                <div className="bg-[#15151a] border border-[#2a2a34] rounded p-8 text-center">
                    <p className="text-sm text-[#9a9aa6] mb-4">
                        Sign in to view your notifications.
                    </p>
                    <a
                        href="/portal/auth"
                        className="text-sm text-[#f472b6] hover:underline"
                    >
                        Sign in
                    </a>
                </div>
                <div className="mt-8">
                    <a href="/portal" className="text-sm text-[#9a9aa6] hover:underline">
                        ← Back to Portal
                    </a>
                </div>
            </main>
        );
    }

    // Authenticated: forward session cookie to notifications endpoint
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('noesis_portal_token')?.value;

    const data = await safeGridFetch<NotificationsResponse>(
        `${PORTAL_ORIGIN}/portal/api/v1/notifications`,
        {
            cache: 'no-store',
            headers: sessionCookie
                ? { Cookie: `noesis_portal_token=${sessionCookie}` }
                : {},
        },
    );
    const notifications: Notification[] = data?.notifications ?? [];

    return (
        <main className="bg-[#0a0a0c] min-h-screen px-8 py-8 max-w-[960px] mx-auto">
            <h1 className="text-xl font-semibold text-[#e8e8ec] mb-2">Notifications</h1>
            <p className="text-sm text-[#9a9aa6] mb-8">
                Your recent activity and system messages.
            </p>

            {notifications.length === 0 ? (
                <p className="text-sm text-[#6a6a76]">No notifications yet.</p>
            ) : (
                <ul className="space-y-3">
                    {notifications.map((n) => (
                        <li
                            key={n.id}
                            className={`bg-[#15151a] border rounded p-4 ${
                                n.read ? 'border-[#2a2a34]' : 'border-[#f472b6]'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <p className="text-sm text-[#e8e8ec]">{n.message}</p>
                                    <p className="text-xs text-[#6a6a76] font-mono mt-1">
                                        {n.type} · {n.created_at}
                                    </p>
                                </div>
                                {!n.read && (
                                    <form
                                        method="POST"
                                        action={`/portal/api/v1/notifications/${n.id}/read`}
                                    >
                                        <button
                                            type="submit"
                                            className="text-xs text-[#9a9aa6] hover:text-[#e8e8ec] shrink-0"
                                        >
                                            Mark read
                                        </button>
                                    </form>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-8">
                <a href="/portal" className="text-sm text-[#9a9aa6] hover:underline">
                    ← Back to Portal
                </a>
            </div>
        </main>
    );
}
