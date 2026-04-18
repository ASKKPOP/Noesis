/**
 * Tailwind 4 uses CSS-first configuration via the `@theme` directive in
 * `src/app/globals.css`. This file exists for tooling compatibility and to
 * declare content paths explicitly when upstream tools expect a config file.
 *
 * Design tokens (colors, spacing, fonts) are declared in `globals.css` per
 * 03-UI-SPEC.md §Spacing / §Typography / §Color.
 */
import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/app/**/*.{ts,tsx}',
        './src/components/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            spacing: {
                // 03-UI-SPEC.md §Spacing Scale — documented exception to the 8-point scale.
                'firehose-row': '28px',
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
            },
            colors: {
                // 03-UI-SPEC.md §Color — dark-only palette.
                dominant: '#0A0A0B',
                secondary: '#17181C',
                tertiary: '#23252B',
                accent: '#7DD3FC',
                'event-movement': '#60A5FA',
                'event-message': '#C084FC',
                'event-trade': '#FBBF24',
                'event-law': '#F472B6',
                'event-lifecycle': '#A3A3A3',
            },
        },
    },
    plugins: [],
};

export default config;
