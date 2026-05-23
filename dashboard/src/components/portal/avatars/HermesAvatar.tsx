'use client';

interface AvatarProps {
    size?: number;
}

/**
 * Hermes avatar — caduceus-inspired glyph, --terracotta fill.
 * Abstract geometric SVG symbol per Phase 27 D-14.
 */
export function HermesAvatar({ size = 44 }: AvatarProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Hermes"
        >
            <circle cx="22" cy="22" r="20" stroke="var(--terracotta)" strokeWidth="1.5" fill="var(--parchment)" />
            {/* Caduceus-inspired vertical staff with double helix */}
            <line x1="22" y1="11" x2="22" y2="33" stroke="var(--terracotta)" strokeWidth="1.5" strokeLinecap="round" />
            <path
                d="M22 16 C18 18 18 22 22 24 C26 26 26 30 22 32"
                stroke="var(--terracotta)"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
            />
            <path
                d="M22 16 C26 18 26 22 22 24 C18 26 18 30 22 32"
                stroke="var(--terracotta)"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
            />
            <circle cx="22" cy="13" r="2.5" fill="var(--terracotta)" />
        </svg>
    );
}

export default HermesAvatar;
