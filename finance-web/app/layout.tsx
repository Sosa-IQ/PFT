import type { Metadata } from 'next'
import QueryProvider from '@/components/QueryProvider'
import ThemeProvider from '@/components/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'BudgIt Buddy',
  description: 'The financial dashboard that turns complex spreadsheets into a beautiful journey toward wealth.',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
}

// Inline script runs before React hydration to avoid flash of wrong theme
const themeScript = `
  (function() {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  })();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-gray-50 text-gray-900 dark:bg-[#0c0c0c] dark:text-white antialiased transition-colors duration-200">
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
