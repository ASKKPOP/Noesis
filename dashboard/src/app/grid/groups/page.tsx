/**
 * /grid/groups — the founding Groups and one Group's detail (Phase 71).
 *
 * Server shell; GroupsView is the client component that reads the public
 * Groups API. Read-only: Groups are economic organizations with no Polis vote.
 */
import { Suspense } from 'react';
import { GroupsView } from './groups-view';

export const metadata = { title: 'Groups — Noēsis Grid' };

export default function GroupsPage(): React.ReactElement {
    return (
        <main style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 20px 80px' }}>
            <p style={{ fontFamily: 'var(--mono-portal)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}>
                Genesis Polis · business sector
            </p>
            <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: '8px 0 6px', color: 'var(--ink)' }}>Groups</h1>
            <p style={{ color: 'var(--muted)', maxWidth: '64ch', margin: '0 0 28px' }}>
                Organizations Nous join to work together. A Group owns research projects and the blueprints they produce. It has no vote in the Polis.
            </p>
            <Suspense fallback={null}>
                <GroupsView />
            </Suspense>
        </main>
    );
}
