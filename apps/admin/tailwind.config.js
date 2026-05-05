/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080a0f',
        'bg-1': '#0d1018',
        'bg-2': '#131720',
        'bg-3': '#1a1f2e',
        'bg-4': '#222840',
        border: '#1e2433',
        ink: '#e8eaf0',
        'ink-2': '#9aa3b8',
        'ink-3': '#6c7a96',
        accent: '#6c8fff',
        danger: '#f56565',
        success: '#48bb78',
        warning: '#f6ad55',
      },
    },
  },
  plugins: [],
};
