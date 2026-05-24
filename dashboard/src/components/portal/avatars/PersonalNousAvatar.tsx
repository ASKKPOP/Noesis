'use client';

interface PersonalNousAvatarProps {
    size?: number;
    style?: React.CSSProperties;
}

export function PersonalNousAvatar({ size = 44, style }: PersonalNousAvatarProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={style}
            aria-label="Personal Nous"
        >
            {/* Background circle — matches Phase 27 avatar pattern */}
            <circle cx="22" cy="22" r="20" fill="rgba(138,106,59,0.10)" />
            {/* Large 4-pointed sparkle centered at (22, 20), outer radius ~10 */}
            <path
                d="M22 10 L23.5 18.5 L32 20 L23.5 21.5 L22 30 L20.5 21.5 L12 20 L20.5 18.5 Z"
                fill="var(--bronze)"
            />
            {/* Small 4-pointed sparkle at (32, 12), outer radius ~5 */}
            <path
                d="M32 7 L32.7 11.3 L37 12 L32.7 12.7 L32 17 L31.3 12.7 L27 12 L31.3 11.3 Z"
                fill="var(--bronze)"
                opacity="0.65"
            />
        </svg>
    );
}

export default PersonalNousAvatar;
