import CivicMap from './CivicMap.js';

/**
 * Civic Map page — server component shell.
 * Renders the raw-SVG CivicMap client component (D-V3-06 invariant).
 */
export default function CivicMapPage() {
    return (
        <main className="bg-[#0a0a0c] min-h-screen px-8 py-8">
            <h1 className="text-xl font-semibold text-[#e8e8ec] mb-6">Civic Map of Genesis Grid</h1>
            <CivicMap />
        </main>
    );
}
