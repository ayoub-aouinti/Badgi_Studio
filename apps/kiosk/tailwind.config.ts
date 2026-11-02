import type { Config } from 'tailwindcss';

// Design tokens from docs/SCREENS.md — do not invent new colors/fonts here.
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
        // Driven by the organiser branding (see hooks/useBrandTheme); defaults in index.css.
        teal: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          light: 'rgb(var(--brand-light) / <alpha-value>)',
          vivid: 'rgb(var(--brand-accent) / <alpha-value>)',
        },
        coral: {
          DEFAULT: '#C4502F',
          light: '#F8DDD3',
        },
        style: {
          pro: { light: '#DDE5EE', dark: '#2D4A6B' },
          caricature: { light: '#F8DDD3', dark: '#9A3B20' },
          crayon: { light: '#E4E4E4', dark: '#1F1F1F' },
        },
      },
      fontFamily: {
        heading: ['"Bricolage Grotesque"', 'sans-serif'],
        body: ['Figtree', 'sans-serif'],
      },
      borderRadius: {
        button: '24px',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
