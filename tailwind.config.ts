import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        accent: '#C8804A',
        'accent-soft': 'rgba(200,128,74,0.08)',
        green: '#5BAD82',
        yellow: '#C89A3A',
        red: '#B05858',
        blue: '#6B8FBF',
        surface: '#141416',
        'surface-2': '#1A1A1D',
        'surface-3': '#222226',
        bg: '#0C0C0E',
        'text-1': '#F0EAE0',
        'text-2': '#857F77',
        'text-3': '#48443E',
      },
    },
  },
  plugins: [],
} satisfies Config
