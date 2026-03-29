'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '✦' },
  { label: 'Transactions', href: '/transactions', icon: '↺' },
  { label: 'Budgets', href: '/budgets', icon: '◫' },
  { label: 'Goals', href: '/goals', icon: '◎' },
  { label: 'Liabilities', href: '/liabilities', icon: '◌' },
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
    <nav className="sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r border-surface-border/80 bg-surface-sidebar/95 px-4 py-5 backdrop-blur-xl">
      <div className="mb-8 flex items-start justify-between gap-3 px-2">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-surface-border">
          <Image
            src="/BudgitBuddy.png"
            alt="Budgit Buddy mascot"
            fill
            sizes="56px"
            className="object-contain p-1.5"
          />
        </div>
        <div className="leading-none">
          <div className="text-[2rem] font-bold tracking-tight text-accent">Budgit</div>
          <div className="-mt-1 text-[2rem] font-bold tracking-tight text-warning-display">Buddy</div>
        </div>
        <ThemeToggle className="border border-surface-border bg-surface-card text-cream-muted hover:bg-surface-hover hover:text-cream dark:text-cream-muted dark:hover:bg-surface-hover dark:hover:text-cream" />
      </div>

      <ul className="flex-1 space-y-1.5">
        {navItems.map(({ label, href, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-accent to-accent-hover text-accent-contrast shadow-[0_10px_30px_rgba(var(--app-accent),0.2)]'
                    : 'text-cream-muted hover:bg-surface-hover hover:text-cream'
                }`}
              >
                <span className={`text-lg leading-none ${active ? 'opacity-90' : 'opacity-70'}`}>{icon}</span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 space-y-3 border-t border-surface-border pt-4">
        <p className="truncate px-2 text-xs uppercase tracking-[0.18em] text-cream-muted/80">
          {(session?.user?.user_metadata?.full_name as string | undefined) || session?.user?.email}
        </p>
        <button
          onClick={handleSignOut}
          className="rounded-xl px-2 py-2 text-left text-sm text-cream-muted transition-colors hover:bg-surface-hover hover:text-danger"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
