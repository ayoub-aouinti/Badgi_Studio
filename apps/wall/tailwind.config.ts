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
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          light: 'rgb(var(--brand-light) / <alpha-value>)',
          vivid: 'rgb(var(--brand-accent) / <alpha-value>)',
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
