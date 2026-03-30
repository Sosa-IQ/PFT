'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (next: Theme) => {
      setTheme(next)
      document.documentElement.classList.toggle('dark', next === 'dark')
    }

    if (stored === 'dark' || stored === 'light') {
      applyTheme(stored)
      return
    }

    applyTheme(media.matches ? 'dark' : 'light')

    const handleChange = (event: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        applyTheme(event.matches ? 'dark' : 'light')
      }
    }

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  function toggle() {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.classList.toggle('dark', next === 'dark')
      localStorage.setItem('theme', next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
