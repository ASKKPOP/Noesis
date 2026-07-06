/**
 * Polis bill detail page (D-36-15).
 * Server component: renders full bill body, tally if tallied.
 *
 * VOTE-05: ballots array stripped server-side; UI MUST NOT expect or render it.
 * Defense-in-depth: this component never accesses .ballots on the bill object.
 * The backend (Plan 05) already omits .ballots from the /api/v1/polis/bills/:id
 * response. This is a UI-layer guard.
 */
import { safeGridFetch } from '@/lib/server-grid-fetch';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface PolisCandidate {
    display_name: string;
    civic_did_hash: string;
}

interface PolisTally {
    yes: number;
    no: number;
    abstain: number;
}

/** Plan 05 response shape — note: NO ballots field per VOTE-05 invariant. */
interface PolisBillDetail {
    id: string;
    title: string;
    body_summary: string;
    full_text: string;
    sponsor: PolisCandidate;
    cosponsors: PolisCandidate[];
    session_status: string;
    tallied: boolean;
    tally?: PolisTally;
    created_at: string;
}

interface BillDetailPageProps {
    params: Promise<{ bill_id: string }>;
}

export default async function BillDetailPage({ params }: BillDetailPageProps) {
    const { bill_id } = await params;

    const bill = await safeGridFetch<PolisBillDetail>(
        `${GRID_ORIGIN}/api/v1/polis/bills/${bill_id}`,
        { cache: 'no-store' },
    );

    if (!bill) {
        return (
            <main className="bg-[#0a0a0c] min-h-screen px-8 py-8 max-w-[960px] mx-auto">
                <p className="text-sm text-[#9a9aa6]">Bill not found or data unavailable.</p>
                <a href="/portal/polis" className="text-sm text-[#6bd968] hover:underline mt-4 block">
                    ← Back to Polis
                </a>
            </main>
        );
    }

    return (
        <main className="bg-[#0a0a0c] min-h-screen px-8 py-8 max-w-[960px] mx-auto">
            <div className="border-l-4 border-l-[#6bd968] pl-6 mb-8">
                <h1 className="text-xl font-semibold text-[#e8e8ec] mb-2">{bill.title}</h1>
                <div className="flex items-center gap-4 text-xs text-[#6a6a76] font-mono">
                    <span>Sponsor: {bill.sponsor.display_name}</span>
                    <span className="uppercase tracking-widest">{bill.session_status}</span>
                    <span>{bill.created_at}</span>
                </div>
            </div>

            {/* Body summary */}
            <section className="mb-6">
                <h2 className="text-xl font-semibold text-[#e8e8ec] mb-3">Summary</h2>
                <p className="text-sm text-[#9a9aa6] leading-normal">{bill.body_summary}</p>
            </section>

            {/* Full text */}
            <section className="mb-6">
                <h2 className="text-xl font-semibold text-[#e8e8ec] mb-3">Full Text</h2>
                <div className="bg-[#15151a] border border-[#2a2a34] rounded p-6">
                    <pre className="text-sm text-[#e8e8ec] whitespace-pre-wrap font-mono leading-relaxed">
                        {bill.full_text}
                    </pre>
                </div>
            </section>

            {/* Cosponsors */}
            {bill.cosponsors.length > 0 && (
                <section className="mb-6">
                    <h2 className="text-xl font-semibold text-[#e8e8ec] mb-3">Cosponsors</h2>
                    <ul className="flex flex-wrap gap-2">
                        {bill.cosponsors.map((c) => (
                            <li key={c.civic_did_hash}>
                                <a
                                    href={`/portal/nous/${c.civic_did_hash}`}
                                    className="text-xs text-[#9a9aa6] hover:text-[#e8e8ec] bg-[#15151a] border border-[#2a2a34] rounded px-3 py-1"
                                >
                                    {c.display_name}
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Tally — shown only when tallied; VOTE-05: no ballots rendered */}
            {bill.tallied && bill.tally && (
                <section className="mb-6">
                    <h2 className="text-xl font-semibold text-[#e8e8ec] mb-3">Tally</h2>
                    <div className="bg-[#15151a] border border-[#2a2a34] rounded p-6 flex items-center gap-8">
                        <div className="text-center">
                            <p className="text-[#6bd968] text-xl font-semibold">{bill.tally.yes}</p>
                            <p className="text-xs text-[#6a6a76] font-mono uppercase">Yes</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[#c084fc] text-xl font-semibold">{bill.tally.no}</p>
                            <p className="text-xs text-[#6a6a76] font-mono uppercase">No</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[#9a9aa6] text-xl font-semibold">{bill.tally.abstain}</p>
                            <p className="text-xs text-[#6a6a76] font-mono uppercase">Abstain</p>
                        </div>
                    </div>
                    {/* VOTE-05: ballots array stripped server-side; UI MUST NOT expect or render it. */}
                </section>
            )}

            <div className="mt-8">
                <a href="/portal/polis" className="text-sm text-[#6bd968] hover:underline">
                    ← Back to Polis
                </a>
            </div>
        </main>
    );
}
