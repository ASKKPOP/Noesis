/**
 * Polis bill drafts view (D-36-15).
 * Server component: visitor browses pending bills + session statuses.
 * Ballots are redacted from the listing view (shown as tally only when tallied).
 * Color accent: Polis green (#6bd968) per UI-SPEC §Color.
 */
import { COPY } from '../../../lib/portal-copy';

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

interface PolisBillSummary {
    id: string;
    title: string;
    sponsor: PolisCandidate;
    cosponsors_count: number;
    session_status: string;
    tallied: boolean;
    tally?: PolisTally;
}

interface PolisResponse {
    bills: PolisBillSummary[];
}

export default async function PolisPage() {
    let bills: PolisBillSummary[] = [];
    try {
        const res = await fetch(`${GRID_ORIGIN}/api/v1/polis/bills`, {
            cache: 'no-store',
        });
        if (res.ok) {
            const data = (await res.json()) as PolisResponse;
            bills = data.bills ?? [];
        }
    } catch {
        // Grid unreachable — empty state renders below
    }

    return (
        <main className="bg-[#0a0a0c] min-h-screen px-8 py-8 max-w-[960px] mx-auto">
            <h1 className="text-xl font-semibold text-[#e8e8ec] mb-2">Genesis Polis</h1>
            <p className="text-sm text-[#9a9aa6] mb-8">
                Legislative bills and active sessions of the Genesis Grid Polis.
            </p>

            {bills.length === 0 ? (
                <p className="text-sm text-[#6a6a76]">{COPY.POLIS_EMPTY}</p>
            ) : (
                <ul className="space-y-4">
                    {bills.map((bill) => (
                        <li
                            key={bill.id}
                            className="bg-[#15151a] border border-[#2a2a34] border-l-4 border-l-[#6bd968] rounded p-6"
                        >
                            <a href={`/portal/polis/${bill.id}`} className="block group">
                                <h2 className="text-xl font-semibold text-[#e8e8ec] group-hover:text-[#6bd968] mb-2">
                                    {bill.title}
                                </h2>
                            </a>
                            <div className="flex items-center gap-4 text-xs text-[#6a6a76] font-mono mb-2">
                                <span>Sponsor: {bill.sponsor.display_name}</span>
                                <span>{bill.cosponsors_count} cosponsor{bill.cosponsors_count !== 1 ? 's' : ''}</span>
                                <span className="uppercase tracking-widest">{bill.session_status}</span>
                            </div>
                            {bill.tallied && bill.tally && (
                                <div className="flex items-center gap-4 text-xs font-mono mt-2">
                                    <span className="text-[#6bd968]">{bill.tally.yes} yes</span>
                                    <span className="text-[#c084fc]">{bill.tally.no} no</span>
                                    <span className="text-[#6a6a76]">{bill.tally.abstain} abstain</span>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-8">
                <a href="/portal" className="text-sm text-[#6bd968] hover:underline">
                    ← Back to Portal
                </a>
            </div>
        </main>
    );
}
