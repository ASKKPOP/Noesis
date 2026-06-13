import Link from 'next/link';
import CivicMap from './CivicMap';

/**
 * Civic Map page — server component shell.
 * Renders the raw-SVG CivicMap client component (D-V3-06 invariant).
 */
export default function CivicMapPage() {
    return (
        <main className="bg-[#0a0a0c] min-h-screen px-8 py-8">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h1 className="text-xl font-semibold text-[#e8e8ec]">Civic Map of Genesis Grid</h1>
                {/* Additive link to the live orbital Genesis Core map (D-58-09). */}
                <Link href="/worldmap/orbital" className="text-sm text-[#38bdf8] hover:underline">
                    Explore the orbital map →
                </Link>
            </div>
            <CivicMap />
        </main>
    );
}
