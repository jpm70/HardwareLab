/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        workbench: { 950: '#090d16', 900: '#0f172a', 850: '#131e34', 800: '#1e293b', 700: '#334155' },
        pcb: { green: '#064e3b', black: '#090a0f', trace: '#14b8a6', gold: '#f59e0b' },
      },
      fontFamily: {
        mono: ['ui-monospace', '"Cascadia Code"', 'Consolas', '"DejaVu Sans Mono"', 'monospace'],
        digital: ['ui-monospace', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
