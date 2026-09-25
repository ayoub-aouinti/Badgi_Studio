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
        teal: {
          DEFAULT: '#0B6E69',
          light: '#DDEFEC',
          vivid: '#5FD3C8',
        },
        coral: {
          DEFAULT: '#C4502F',
          light: '#F8DDD3',
        },
        style: {
          pro: { light: '#DDE5EE', dark: '#2D4A6B' },
          caricature: { light: '#F8DDD3', dark: '#9A3B20' },
          peint: { light: '#E9DCC2', blue: '#2C6FB0' },
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
