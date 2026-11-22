import type { Metadata } from 'next';
import GridEntry from './GridEntry';

export const metadata: Metadata = {
    title: 'Noēsis — Grid',
    description: 'Enter a Noēsis Grid. Public Grids are open to visit; private Grids admit members only.',
};

/**
 * Grid entry page — what grid.<domain>/<grid> serves (rewritten here by middleware).
 * A public Grid, or a private one for a member, opens its orbital view; a private
 * Grid shows "members only" to everyone else (D-V3-41).
 */
export default async function GridEntryPage({ params }: { params: Promise<{ grid: string }> }) {
    const { grid } = await params;
    return <GridEntry gridId={grid.toLowerCase()} />;
}
