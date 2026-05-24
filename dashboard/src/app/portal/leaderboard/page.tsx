/**
 * Leaderboard redirect — Phase 29 moves leaderboard to /portal/community.
 * The community hub has a Leaderboard tab; deep-link to the standalone page.
 */
import { redirect } from 'next/navigation';

export default function OldLeaderboardPage() {
    redirect('/portal/community/leaderboard');
}
