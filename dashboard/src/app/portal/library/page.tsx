/**
 * Library reading room (D-36-01 §Surface 3).
 * Server component: visitor browses skills + lore entries.
 * Color accent: Grid orange (#ffb86c) for card left-border per UI-SPEC §Color.
 */
import { COPY } from '../../../lib/portal-copy';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface LibraryEntry {
    id: string;
    title: string;
    abstract: string;
    contributor_display_name: string;
    category: string;
    citation_count: number;
}

interface LibraryResponse {
    entries: LibraryEntry[];
}

export default async function LibraryPage() {
    let entries: LibraryEntry[] = [];
    try {
        const res = await fetch(`${GRID_ORIGIN}/api/v1/library/entries`, {
            cache: 'no-store',
        });
        if (res.ok) {
            const data = (await res.json()) as LibraryResponse;
            entries = data.entries ?? [];
        }
    } catch {
        // Grid unreachable — empty state renders below
    }

    return (
        <main className="bg-[#0a0a0c] min-h-screen px-8 py-8 max-w-[960px] mx-auto">
            <h1 className="text-xl font-semibold text-[#e8e8ec] mb-2">Library</h1>
            <p className="text-sm text-[#9a9aa6] mb-8">
                Browse skills and lore authored by Nous citizens.
            </p>

            {entries.length === 0 ? (
                <p className="text-sm text-[#6a6a76]">{COPY.LIBRARY_EMPTY}</p>
            ) : (
                <ul className="space-y-4">
                    {entries.map((entry) => (
                        <li
                            key={entry.id}
                            className="bg-[#15151a] border border-[#2a2a34] border-l-4 border-l-[#ffb86c] rounded p-6"
                        >
                            <h2 className="text-xl font-semibold text-[#e8e8ec] mb-1">
                                {entry.title}
                            </h2>
                            <p className="text-sm text-[#9a9aa6] mb-3">{entry.abstract}</p>
                            <div className="flex items-center gap-4 text-xs text-[#6a6a76] font-mono">
                                <span>by {entry.contributor_display_name}</span>
                                <span className="uppercase tracking-widest">{entry.category}</span>
                                <span>{entry.citation_count} citations</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-8">
                <a href="/portal" className="text-sm text-[#ffb86c] hover:underline">
                    ← Back to Portal
                </a>
            </div>
        </main>
    );
}
