import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#080a0f',
          1: '#0d1018',
          2: '#131720',
          3: '#1a1f2e',
          4: '#222840',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          strong: 'rgba(255,255,255,0.12)',
        },
        ink: {
          DEFAULT: '#e8eaf2',
          2: '#9098b0',
          3: '#5a6278',
        },
        accent: {
          DEFAULT: '#6c8fff',
          2: '#4e6ee8',
          3: '#3558d6',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        purple: '#a78bfa',
        cyan: '#22d3ee',
      },
      fontFamily: {
        sans: ['Geist', ...defaultTheme.fontFamily.sans],
        mono: ['Geist Mono', ...defaultTheme.fontFamily.mono],
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out',
        'pulse-dot': 'pulseDot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(12px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        pulseDot: {
          '0%, 100%': {
            transform: 'scale(1)',
            opacity: '1',
          },
          '50%': {
            transform: 'scale(1.4)',
            opacity: '0.6',
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
