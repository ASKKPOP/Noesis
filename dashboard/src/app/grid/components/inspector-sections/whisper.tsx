'use client';
/**
 * WhisperSection — counts-only Whisper activity panel.
 *
 * Phase 11 WHISPER-02 / D-11-15 UI-SPEC enforcement:
 *   - Renders {sent, received, last whisper tick, top-5 partners by count}
 *   - ZERO read/inspect affordance — not even a disabled button
 *   - NO ciphertext displayed
 *   - NO ciphertext_hash displayed
 *   - NO plaintext of any kind
 *   - Counts visible at all H tiers (no tier-gating — D-11-15)
 *
 * Consumes useWhisperCounts hook (firehose-derived; zero new RPC).
 *
 * T-10-03 mitigation: this component has zero read/decrypt/inspect affordance.
 * Any future affordance that reveals envelope content requires its own Phase
 * with an explicit new allowlist addition and IrreversibilityDialog (H5 pattern).
 *
 * See: 11-CONTEXT.md D-11-15. WHISPER-02. T-10-03.
 */

import { useWhisperCounts } from '@/lib/hooks/use-whisper-counts';

/**
 * Truncate a DID for compact display: show first 16 chars + '…'
 * Never displays ciphertext_hash or any envelope field.
 */
function truncateDid(did: string): string {
    if (did.length <= 20) return did;
    return did.slice(0, 16) + '\u2026'; // U+2026 HORIZONTAL ELLIPSIS
}

export function WhisperSection({ did }: { did: string }): React.ReactElement {
    const { sent, received, lastTick, topPartners } = useWhisperCounts(did);

    return (
        <section aria-label="Whisper activity" data-section="whisper">
            <h3>Whisper</h3>
            <dl>
                <dt>Sent</dt>
                <dd>{sent}</dd>

                <dt>Received</dt>
                <dd>{received}</dd>

                <dt>Last whisper tick</dt>
                <dd>{lastTick !== null ? lastTick : '\u2014'}</dd>

                <dt>Top partners</dt>
                <dd>
                    {topPartners.length === 0 ? (
                        <span>\u2014</span>
                    ) : (
                        <ul>
                            {topPartners.map(p => (
                                <li key={p.did}>
                                    {truncateDid(p.did)}{'\u00a0'}\u2014{'\u00a0'}{p.count}
                                </li>
                            ))}
                        </ul>
                    )}
                </dd>
            </dl>
        </section>
    );
}
