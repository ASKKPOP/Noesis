'use client';

interface AvatarProps {
    size?: number;
}

/**
 * Sophia avatar — spiral / phi-inspired glyph, --bronze fill.
 * Abstract geometric SVG symbol per Phase 27 D-14.
 */
export function SophiaAvatar({ size = 44 }: AvatarProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Sophia"
        >
            <circle cx="22" cy="22" r="20" stroke="var(--bronze)" strokeWidth="1.5" fill="var(--parchment)" />
            {/* Phi-inspired spiral glyph */}
            <path
                d="M22 10 C28 10 32 15 32 21 C32 27 27 31 21 31 C15 31 11 27 11 21"
                stroke="var(--bronze)"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
            />
            <path
                d="M22 14 C26 14 28 17 28 21 C28 25 25 27 22 27 C19 27 17 25 17 21"
                stroke="var(--bronze)"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
            />
            <circle cx="22" cy="21" r="2" fill="var(--bronze)" />
        </svg>
    );
}

export default SophiaAvatar;
