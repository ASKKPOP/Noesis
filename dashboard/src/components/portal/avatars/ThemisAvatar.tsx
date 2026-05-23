'use client';

interface ThemisAvatarProps {
    size?: number;
    style?: React.CSSProperties;
}

/**
 * Themis avatar — balanced scales glyph, --navy palette.
 */
export function ThemisAvatar({ size = 44, style }: ThemisAvatarProps) {
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
            <circle cx="22" cy="22" r="20" fill="rgba(22,33,61,0.10)" />
            {/* Horizontal beam */}
            <line x1="10" y1="16" x2="34" y2="16" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round" />
            {/* Central fulcrum */}
            <line x1="22" y1="16" x2="22" y2="34" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round" />
            {/* Left pan */}
            <line x1="8" y1="26" x2="16" y2="26" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" />
            {/* Right pan */}
            <line x1="28" y1="26" x2="36" y2="26" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" />
            {/* Left suspension */}
            <line x1="10" y1="16" x2="12" y2="26" stroke="var(--navy)" strokeWidth="1" strokeLinecap="round" />
            {/* Right suspension */}
            <line x1="34" y1="16" x2="32" y2="26" stroke="var(--navy)" strokeWidth="1" strokeLinecap="round" />
            {/* Triangle base */}
            <polygon points="18,38 22,32 26,38" fill="var(--navy)" opacity="0.6" />
        </svg>
    );
}

export default ThemisAvatar;
