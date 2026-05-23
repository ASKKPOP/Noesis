'use client';

interface AvatarProps {
    size?: number;
}

/**
 * Themis avatar — scales / balanced triangle glyph, --navy fill.
 * Abstract geometric SVG symbol per Phase 27 D-14.
 */
export function ThemisAvatar({ size = 44 }: AvatarProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Themis"
        >
            <circle cx="22" cy="22" r="20" stroke="var(--navy)" strokeWidth="1.5" fill="var(--parchment)" />
            {/* Scales of justice — balanced triangle glyph */}
            <line x1="22" y1="12" x2="22" y2="30" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="14" y1="16" x2="30" y2="16" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" />
            {/* Left pan */}
            <path d="M12 18 L14 24 L16 18 Z" fill="var(--navy)" opacity="0.7" />
            {/* Right pan */}
            <path d="M28 18 L30 24 L32 18 Z" fill="var(--navy)" opacity="0.7" />
            {/* Base */}
            <line x1="18" y1="30" x2="26" y2="30" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

export default ThemisAvatar;
