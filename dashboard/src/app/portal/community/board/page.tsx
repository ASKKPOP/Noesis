/**
 * Community Board — standalone route at /portal/community/board.
 * Redirects to the tabbed community hub at /portal/community where board content lives.
 * Phase 29 COM-02.
 */
import { redirect } from 'next/navigation';

export default function BoardPage() {
    redirect('/portal/community');
}
