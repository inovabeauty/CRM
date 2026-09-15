/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        inova: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          900: '#064e3b',
        }
      }
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#059669",
          "primary-content": "#ffffff",
          "secondary": "#0284c7",
          "secondary-content": "#ffffff",
          "accent": "#d97706",
          "accent-content": "#ffffff",
          "neutral": "#1e293b",
          "neutral-content": "#f8fafc",
          "base-100": "#ffffff",
          "base-200": "#f8fafc",
          "base-300": "#e2e8f0",
          "base-content": "#0f172a",
          "info": "#0284c7",
          "success": "#16a34a",
          "warning": "#d97706",
          "error": "#dc2626",
        },
        dark: {
          "primary": "#10b981",
          "primary-content": "#0f172a",
          "secondary": "#38bdf8",
          "secondary-content": "#0f172a",
          "accent": "#f59e0b",
          "accent-content": "#0f172a",
          "neutral": "#0f172a",
          "neutral-content": "#f8fafc",
          "base-100": "#0b0f19",
          "base-200": "#111827",
          "base-300": "#1f2937",
          "base-content": "#f8fafc",
          "info": "#38bdf8",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#f43f5e",
        },
      },
    ],
  },
}
