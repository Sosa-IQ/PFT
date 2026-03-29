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
          DEFAULT: '#0e1525',   // app canvas
          sidebar: '#131c31',   // sidebar background
          card: '#18233a',      // elevated surface
          border: '#263552',    // subtle borders
          hover: '#1d2944',     // hover backgrounds
          raised: '#202d48',    // stronger elevation / active chips
        },
        cream: {
          DEFAULT: '#f4efe2',   // primary text
          muted: '#8e9bb7',     // secondary / muted text
        },
        accent: {
          DEFAULT: '#67e7a9',   // mint accent
          hover: '#7cf0b6',     // accent hover
          contrast: '#09111d',  // text on accent fills
        },
        warning: {
          DEFAULT: '#f1db8f',   // sand / debt accent
          soft: '#f5e6ad',
        },
        danger: {
          DEFAULT: '#ff8b88',   // destructive / errors
          soft: '#ffb0ab',
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
