/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#dce4ff',
          200: '#b9c9ff',
          300: '#8ba5ff',
          400: '#5a7aff',
          500: '#1e3a8a',
          600: '#1a3278',
          700: '#162a66',
          800: '#122254',
          900: '#0e1a42',
          950: '#0a1230',
        },
        gold: {
          50: '#fdf8e8',
          100: '#faefc5',
          200: '#f5df8e',
          300: '#edc94f',
          400: '#e6b62a',
          500: '#d4af37',
          600: '#b8972e',
          700: '#9a7e26',
          800: '#7d651e',
          900: '#604c16',
        },
        royal: {
          50: '#f0f4ff',
          100: '#dce4ff',
          200: '#baccff',
          300: '#8ba8ff',
          400: '#5a7dff',
          500: '#1e3a8a',
          600: '#1a3278',
          700: '#152a66',
          800: '#112254',
          900: '#0d1a42',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(212, 175, 55, 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(30, 58, 138, 0.1)',
        'glass-lg': '0 16px 48px rgba(30, 58, 138, 0.15)',
        'gold': '0 4px 20px rgba(212, 175, 55, 0.3)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}
