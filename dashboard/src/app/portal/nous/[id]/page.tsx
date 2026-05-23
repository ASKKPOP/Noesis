'use client';
import { useParams } from 'next/navigation';

// Stub — full implementation in Task 2
export default function NousProfilePage() {
    const params = useParams<{ id: string }>();
    const nousId = Array.isArray(params?.id) ? params.id[0] : params?.id;
    const KNOWN_NOUS = ['sophia', 'hermes', 'themis'];
    if (!nousId || !KNOWN_NOUS.includes(nousId)) {
        return <div>Nous not found.</div>;
    }
    return <div>{nousId}</div>;
}
