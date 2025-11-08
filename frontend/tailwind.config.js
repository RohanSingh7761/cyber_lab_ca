/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#f97316',
          foreground: '#ffffff',
        },
        background: '#000000',
        foreground: '#ffffff',
        surface: '#0a0a0a',
        border: '#1a1a1a',
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem'
      }
    }
  },
  plugins: [],
}
