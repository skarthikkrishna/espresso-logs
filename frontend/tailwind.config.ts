import type { Config } from 'tailwindcss'
import daisyui from 'daisyui'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        'espresso-dark': {
          'primary': '#d97706',
          'primary-content': '#ffffff',
          'secondary': '#92400e',
          'secondary-content': '#ffffff',
          'accent': '#f59e0b',
          'accent-content': '#1a1209',
          'neutral': '#2d1f0e',
          'neutral-content': '#f5e6d3',
          'base-100': '#1a1209',
          'base-200': '#22160b',
          'base-300': '#2d1f0e',
          'base-content': '#f5e6d3',
          'info': '#3b82f6',
          'success': '#10b981',
          'warning': '#f59e0b',
          'error': '#ef4444',
        },
      },
    ],
    darkTheme: 'espresso-dark',
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
}

export default config
