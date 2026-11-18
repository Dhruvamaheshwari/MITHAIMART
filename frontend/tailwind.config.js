/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        palette: {
          cream: '#FFF8EC',
          sand: '#E8D5B5',
          terracotta: '#9B4A32',
          mahogany: '#542B24',
          gold: '#C99A42',
        },
        brand: {
          mahogany: '#542B24',
          terracotta: '#9B4A32',
          gold: '#C99A42',
          sand: '#E8D5B5',
          cream: '#FFF8EC',
          charcoal: '#331B17',
          // backward compatibility aliases
          purple: '#542B24',
          'purple-dark': '#3D1F1A',
          'purple-light': '#FFF8EC',
          red: '#9B4A32',
          saffron: '#C99A42',
        },
        kanti: {
          purple: '#542B24',
          dark: '#3D1F1A',
          hover: '#9B4A32',
          light: '#FFF8EC',
          lavender: '#E8D5B5',
          border: '#E8D5B5',
          pill: '#FFF8EC',
          badge: '#FFF8EC',
          badgeText: '#9B4A32',
        },
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(24px)' }, '100%': { opacity: '1', transform: 'none' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'pop-in': { '0%': { opacity: '0', transform: 'scale(0.6)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        shimmer: { '0%': { backgroundPosition: '0% 50%' }, '100%': { backgroundPosition: '200% 50%' } },
      },
      animation: {
        'fade-up': 'fade-up 0.8s ease-out both',
        'fade-in': 'fade-in 1s ease-out both',
        'pop-in': 'pop-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        float: 'float 6s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
        shimmer: 'shimmer 6s linear infinite',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
