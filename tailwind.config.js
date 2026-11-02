/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,mdx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          950: '#172554',
        },
        canvas: '#f6f8fb',
      },
      boxShadow: {
        card: '0 16px 48px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
