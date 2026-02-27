'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '◈' },
  { label: 'Transactions', href: '/transactions', icon: '↕' },
  { label: 'Budgets', href: '/budgets', icon: '⊕' },
  { label: 'Goals', href: '/goals', icon: '◎' },
  { label: 'Liabilities', href: '/liabilities', icon: '⊖' },
  { label: 'Settings', href: '/settings', icon: '⚙' },
]

export default function NavSidebar({ session }: { session: Session | null }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <nav className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col px-4 py-6 shrink-0">
      {/* Brand */}
      <div className="mb-8 px-1">
        <span className="text-lg font-bold text-blue-600">Finance</span>
        <span className="text-lg font-bold text-gray-800"> Tracker</span>
      </div>

      {/* Nav links */}
      <ul className="space-y-1 flex-1">
        {navItems.map(({ label, href, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* User + sign out */}
      <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
        <p className="text-xs text-gray-400 truncate px-1">{session?.user?.email}</p>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-red-500 transition-colors px-1"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
