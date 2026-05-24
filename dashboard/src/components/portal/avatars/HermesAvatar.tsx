'use client';

interface HermesAvatarProps {
    size?: number;
    style?: React.CSSProperties;
}

/**
 * Hermes avatar — caduceus helix glyph, --terracotta palette.
 */
export function HermesAvatar({ size = 44, style }: HermesAvatarProps) {
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
            <circle cx="22" cy="22" r="20" fill="rgba(184,84,47,0.10)" />
            {/* Central staff */}
            <line x1="22" y1="8" x2="22" y2="38" stroke="var(--terracotta)" strokeWidth="2" strokeLinecap="round" />
            {/* Left S-curve */}
            <path
                d="M22,12 C14,16 30,22 22,28"
                stroke="var(--terracotta)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
            />
            {/* Right S-curve */}
            <path
                d="M22,12 C30,16 14,22 22,28"
                stroke="var(--terracotta)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
            />
            {/* Left wing */}
            <line x1="22" y1="8" x2="15" y2="12" stroke="var(--terracotta)" strokeWidth="1.5" strokeLinecap="round" />
            {/* Right wing */}
            <line x1="22" y1="8" x2="29" y2="12" stroke="var(--terracotta)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

export default HermesAvatar;
