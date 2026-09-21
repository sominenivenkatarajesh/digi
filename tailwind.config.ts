import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050811',
          900: '#070b14',
          850: '#0b1120',
          800: '#0f172a',
          700: '#1e293b',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        gold: {
          300: '#fde68a',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        display: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 24s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
