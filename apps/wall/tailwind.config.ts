import type { Config } from 'tailwindcss';

// Same design tokens as apps/kiosk (docs/SCREENS.md) — kept in sync manually, no shared
// config package for just two color palettes.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F4F6F5',
        ink: '#0E1B2C',
        'ink-soft': '#3F4D5C',
        'ink-soft-2': '#4A5868',
        border: '#C9D2D0',
        'border-soft': '#E3E8E7',
        teal: {
          DEFAULT: '#0B6E69',
          light: '#DDEFEC',
          vivid: '#5FD3C8',
        },
        coral: {
          DEFAULT: '#C4502F',
          light: '#F8DDD3',
        },
      },
      fontFamily: {
        heading: ['"Bricolage Grotesque"', 'sans-serif'],
        body: ['Figtree', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
