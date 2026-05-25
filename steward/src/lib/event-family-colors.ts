/**
 * Phase 34: shared event-family color palette. Extracted from /firehose/page.tsx so the
 * Phase 34 EventsPerMinuteSparkline and the existing firehose page render from one source
 * of truth. Per UI-SPEC §"Event-Family Color Palette for /firehose".
 *
 * Coverage: 12 named prefixes + 'unknown' fallback. Together they cover most of the
 * 56-event allowlist. Events without a matching prefix (proposal.*, ballot.*, telos.*,
 * tick, grid.*) fall through to 'unknown' palette — acceptable for v2.6.
 */

export const EVENT_FAMILY_COLORS: Record<string, { leftBorder: string; badgeBg: string; badgeText: string }> = {
    'operator.': { leftBorder: '#b8542f', badgeBg: 'rgba(184,84,47,0.10)', badgeText: '#b8542f' },
    'nous.':     { leftBorder: '#3a7a5a', badgeBg: 'rgba(58,122,90,0.10)',  badgeText: '#2d6b4a' },
    'trade.':    { leftBorder: '#8a6a2e', badgeBg: 'rgba(138,106,46,0.10)', badgeText: '#7a5a20' },
    'law.':      { leftBorder: '#3a4a7a', badgeBg: 'rgba(58,74,122,0.10)',  badgeText: '#3a4a7a' },
    'iris.':     { leftBorder: '#2a7a8a', badgeBg: 'rgba(42,122,138,0.10)', badgeText: '#1e6a7a' },
    'skill.':    { leftBorder: '#7a6a2e', badgeBg: 'rgba(122,106,46,0.10)', badgeText: '#6a5a1e' },
    'norm.':     { leftBorder: '#5a5a6a', badgeBg: 'rgba(90,90,106,0.10)',  badgeText: '#4a4a5a' },
    'lore.':     { leftBorder: '#6a4a7a', badgeBg: 'rgba(106,74,122,0.10)', badgeText: '#5a3a6a' },
    'human.':    { leftBorder: '#2a6a2a', badgeBg: 'rgba(42,106,42,0.10)',  badgeText: '#1e5a1e' },
    'ananke.':   { leftBorder: '#7a3a6a', badgeBg: 'rgba(122,58,106,0.10)', badgeText: '#6a2a5a' },
    'portal.':   { leftBorder: '#4a7a6a', badgeBg: 'rgba(74,122,106,0.10)', badgeText: '#3a6a5a' },
    'bios.':     { leftBorder: '#a06a2e', badgeBg: 'rgba(160,106,46,0.10)', badgeText: '#8a5a20' },
    'unknown':   { leftBorder: '#dbd8cc', badgeBg: 'rgba(219,216,204,0.30)', badgeText: '#8a8479' },
};

/**
 * Resolve event type → family color tuple. Prefix-match loop; falls through to 'unknown'.
 * Exact-match copy of the helper currently inline at firehose/page.tsx:26-33.
 */
export function getFamilyColors(eventType: string): { leftBorder: string; badgeBg: string; badgeText: string } {
    for (const prefix of Object.keys(EVENT_FAMILY_COLORS)) {
        if (prefix !== 'unknown' && eventType.startsWith(prefix)) {
            return EVENT_FAMILY_COLORS[prefix];
        }
    }
    return EVENT_FAMILY_COLORS['unknown'];
}

/**
 * Resolve event type → short family name (prefix without trailing dot). Exact-match copy
 * of the helper currently inline at firehose/page.tsx:35-42.
 */
export function getFamilyName(eventType: string): string {
    for (const prefix of Object.keys(EVENT_FAMILY_COLORS)) {
        if (prefix !== 'unknown' && eventType.startsWith(prefix)) {
            return prefix.replace('.', '');
        }
    }
    return 'unknown';
}
