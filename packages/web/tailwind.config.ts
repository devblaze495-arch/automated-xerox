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
        background: '#030712', // slate-950 / deepest void
        surface: {
          dark: '#0B0F19', // slate-900 elevated
          card: '#111827', // slate-900 card
          elevated: '#1F2937', // slate-800
          border: '#374151', // slate-700
        },
        brand: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          400: '#38BDF8',
          500: '#0EA5E9', // sky-500
          600: '#0284C7', // sky-600
          700: '#0369A1',
        },
        accent: {
          blue: '#2563EB', // blue-600
          cyan: '#06B6D4',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;

