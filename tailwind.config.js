/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a0f1e',
          800: '#0d1529',
          700: '#111d35',
          600: '#162040',
          500: '#1a2a52',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
        },
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
