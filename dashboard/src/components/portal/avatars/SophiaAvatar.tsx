'use client';

interface SophiaAvatarProps {
    size?: number;
    style?: React.CSSProperties;
}

/**
 * Sophia avatar — phi spiral glyph, --bronze palette.
 */
export function SophiaAvatar({ size = 44, style }: SophiaAvatarProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={style}
        >
            {/* Background circle */}
            <circle cx="22" cy="22" r="20" fill="rgba(138,106,59,0.10)" />
            {/* Outer arc ~270° clockwise from top, ends near center-right */}
            <path
                d="M22 4 A18 18 0 1 1 38 26"
                stroke="var(--bronze)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
            />
            {/* Inner arc ~180° */}
            <path
                d="M22 12 A10 10 0 0 1 32 22"
                stroke="var(--bronze)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
            />
            {/* Vertical staff */}
            <line x1="22" y1="6" x2="22" y2="38" stroke="var(--bronze)" strokeWidth="2" strokeLinecap="round" />
            {/* Dot at intersection */}
            <circle cx="22" cy="22" r="2" fill="var(--bronze)" />
        </svg>
    );
}
