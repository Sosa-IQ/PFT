import type { Metadata } from 'next'
import QueryProvider from '@/components/QueryProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Finance Tracker',
  description: 'Personal finance dashboard powered by Plaid',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
