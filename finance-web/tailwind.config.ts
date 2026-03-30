import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--app-surface) / <alpha-value>)',
          sidebar: 'rgb(var(--app-surface-sidebar) / <alpha-value>)',
          card: 'rgb(var(--app-surface-card) / <alpha-value>)',
          border: 'rgb(var(--app-surface-border) / <alpha-value>)',
          hover: 'rgb(var(--app-surface-hover) / <alpha-value>)',
          raised: 'rgb(var(--app-surface-raised) / <alpha-value>)',
        },
        cream: {
          DEFAULT: 'rgb(var(--app-text) / <alpha-value>)',
          muted: 'rgb(var(--app-text-muted) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--app-accent) / <alpha-value>)',
          hover: 'rgb(var(--app-accent-hover) / <alpha-value>)',
          contrast: 'rgb(var(--app-accent-contrast) / <alpha-value>)',
          text: 'rgb(var(--app-accent-text) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--app-warning) / <alpha-value>)',
          soft: 'rgb(var(--app-warning-soft) / <alpha-value>)',
          display: 'rgb(var(--app-warning-display) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--app-danger) / <alpha-value>)',
          soft: 'rgb(var(--app-danger-soft) / <alpha-value>)',
        },
      },
      boxShadow: {
        app: '0 24px 60px rgba(5, 11, 25, 0.28)',
        card: '0 18px 45px rgba(5, 11, 25, 0.22)',
      },
    },
  },
  plugins: [],
}

export default config
