export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    screens: {
      xs: '400px',
      sm: '640px',
      md: '768px',
      tablet: '640px',
      laptop: '1024px',
      lg: '1024px',
      xl: '1280px',
      desktop: '1440px',
      '2xl': '1440px',
    },
    extend: {
      colors: {
        primary: {
          50: '#f0ecff',
          100: '#e0d8ff',
          200: '#c4b5fd',
          300: '#a78bfa',
          400: '#8b5cf6',
          500: '#5b3fc7',
          600: '#4a2eb8',
          700: '#3b22a0',
        }
      }
    }
  },
  plugins: []
}