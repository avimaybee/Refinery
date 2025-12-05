/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        accent: '#6B8AFC',
        background: {
          app: '#0A0A0A',
          card: 'rgba(20, 20, 20, 0.8)',
        },
        text: {
          primary: '#E8E8E8',
          secondary: '#A9A9A9',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.08)',
        },
        glow: {
          primary: 'rgba(107, 138, 252, 0.3)',
        },
      },
      boxShadow: {
        'dark-glow': '0 0 20px rgba(107, 138, 252, 0.3), inset 0 0 8px rgba(107, 138, 252, 0.15)',
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
      },
      transitionDuration: {
        'base': '250ms',
      },
      transitionTimingFunction: {
        'ease-out-custom': 'cubic-bezier(0.25, 0.8, 0.25, 1)',
      },
    },
  },
  plugins: [],
}