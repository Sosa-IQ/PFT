'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ThemeToggle from '@/components/ThemeToggle'

const features = [
  {
    icon: (
      <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: 'Real-time tracking',
    description: 'Connect your bank via Plaid and watch every transaction sync instantly. Every dollar categorized and accounted for automatically.',
    highlight: (
      <div className="mt-4 flex w-fit items-center gap-3 rounded-xl border border-surface-border bg-surface px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        <span className="font-mono text-sm text-cream-muted">−$42.00 · Groceries</span>
      </div>
    ),
  },
  {
    icon: (
      <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Secure connections',
    description: 'Bank-level 256-bit encryption. Your data is yours — stored in Supabase with row-level security enforced for every query.',
    highlight: (
      <div className="mt-4 flex items-center gap-2 text-sm font-medium text-accent-text dark:text-accent">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
        </svg>
        ENCRYPTION ACTIVE
      </div>
    ),
  },
  {
    icon: (
      <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: 'Smart budgets',
    description: 'Set monthly budgets per category, track spending in real time, and get notified before you overspend.',
    highlight: null,
  },
  {
    icon: (
      <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
      </svg>
    ),
    title: 'Savings goals',
    description: 'Define goals, track your progress, and celebrate every milestone on your path to financial freedom.',
    highlight: null,
  },
]

// Mascot card rendered separately (full-width, special layout)
function BuddyCard() {
  return (
    <div className="app-panel md:col-span-2 flex items-center justify-between gap-6 rounded-3xl border-accent/20 bg-gradient-to-br from-accent/10 via-surface-card to-warning/10 p-7">
      <div className="flex-1">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent-text dark:text-accent">Meet your Buddy</p>
        <h3 className="mb-3 text-xl font-bold text-cream">A Buddy who cares</h3>
        <p className="max-w-sm text-sm leading-relaxed text-cream-muted">
          Your mascot doesn&apos;t just look cute — it nudges you when you&apos;re over budget
          and celebrates your wins. Financial wellness with a personality.
        </p>
      </div>
      <div className="shrink-0">
        <Image
          src="/BudgitBuddy.png"
          alt="BudgIt Buddy mascot"
          width={120}
          height={120}
          className="drop-shadow-lg"
        />
      </div>
    </div>
  )
}

const stats = [
  { value: '100%', label: 'Open Source' },
  { value: 'Plaid', label: 'Bank Sync' },
  { value: 'Zero', label: 'Data Selling' },
  { value: '24/7', label: 'Your Data, Your Rules' },
]

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  return (
    <div className="app-shell min-h-screen text-cream transition-colors duration-200">
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-surface-border bg-surface-sidebar/85 backdrop-blur-md transition-colors duration-200">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="BudgIt Buddy" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-bold tracking-tight"><span className="text-accent">BudgIt</span> <span className="text-warning-display">Buddy</span></span>
          </div>
          <div className="absolute left-1/2 hidden md:block">
            <div className="relative text-xs text-cream-muted sm:text-sm">
              <a
                href="#features"
                className="absolute right-1/2 top-1/2 mr-8 -translate-y-1/2 font-medium text-accent-text transition-colors hover:text-accent-hover dark:text-accent sm:mr-10 md:mr-12"
              >
                Features
              </a>
              <a
                href="#stats"
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-colors hover:text-cream"
              >
                Pricing
              </a>
              <a
                href="#cta"
                className="absolute left-1/2 top-1/2 ml-8 -translate-y-1/2 transition-colors hover:text-cream sm:ml-10 md:ml-12"
              >
                About
              </a>
            </div>
          </div>
          <div className="hidden items-center justify-end gap-2 md:flex">
            <ThemeToggle className="border border-surface-border bg-surface-card text-cream-muted hover:bg-surface-hover hover:text-cream dark:text-cream-muted dark:hover:bg-surface-hover dark:hover:text-cream" />
            <Link href="/login" className="px-4 py-2 text-sm text-cream-muted transition-colors hover:text-cream">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
            >
              Get Started
            </Link>
          </div>
          <div className="flex items-center justify-end gap-2 md:hidden">
            <ThemeToggle className="border border-surface-border bg-surface-card text-cream-muted hover:bg-surface-hover hover:text-cream dark:text-cream-muted dark:hover:bg-surface-hover dark:hover:text-cream" />
            <button
              type="button"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav-menu"
              aria-label="Open navigation menu"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface-card text-cream transition-colors hover:bg-surface-hover"
            >
              <span className="sr-only">Menu</span>
              <span className="flex flex-col gap-1.5">
                <span className="h-0.5 w-5 rounded-full bg-current" />
                <span className="h-0.5 w-5 rounded-full bg-current" />
                <span className="h-0.5 w-5 rounded-full bg-current" />
              </span>
            </button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div
            id="mobile-nav-menu"
            className="border-t border-surface-border bg-surface-sidebar/95 px-6 py-4 md:hidden"
          >
            <div className="flex flex-col gap-2 text-sm text-cream">
              <a
                href="#features"
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2 font-medium text-accent-text transition-colors hover:bg-surface-hover hover:text-accent-hover dark:text-accent"
              >
                Features
              </a>
              <a
                href="#stats"
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2 transition-colors hover:bg-surface-hover hover:text-cream"
              >
                Pricing
              </a>
              <a
                href="#cta"
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2 transition-colors hover:bg-surface-hover hover:text-cream"
              >
                About
              </a>
              <Link
                href="/login"
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2 transition-colors hover:bg-surface-hover hover:text-cream"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                onClick={closeMobileMenu}
                className="rounded-lg bg-accent px-3 py-2 text-center font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-card px-4 py-1.5 text-xs text-cream-muted shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Your financial co-pilot is here
        </div>
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-tight tracking-tight text-cream md:text-6xl">
          Master Your Money<br />
          <span className="text-accent">with a Buddy</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-cream-muted">
          The editorial financial dashboard that turns complex spreadsheets
          into a beautiful, intuitive journey toward wealth.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 min-[480px]:hidden">
          <Link
            href="/signup"
            className="rounded-xl bg-accent px-7 py-3 text-sm font-semibold text-accent-contrast shadow-md shadow-[rgba(var(--app-accent),0.2)] transition-colors hover:bg-accent-hover"
          >
            Start for Free
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-surface-border px-7 py-3 text-sm font-semibold text-cream transition-colors hover:border-cream-muted hover:bg-surface-card"
          >
            View Demo
          </Link>
        </div>
        <div className="relative mt-10 hidden h-12 min-[480px]:block">
          <Link
            href="/signup"
            className="absolute right-1/2 mr-2 rounded-xl bg-accent px-7 py-3 text-sm font-semibold text-accent-contrast shadow-md shadow-[rgba(var(--app-accent),0.2)] transition-colors hover:bg-accent-hover"
          >
            Start for Free
          </Link>
          <Link
            href="/login"
            className="absolute left-1/2 ml-2 rounded-xl border border-surface-border px-7 py-3 text-sm font-semibold text-cream transition-colors hover:border-cream-muted hover:bg-surface-card"
          >
            View Demo
          </Link>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="px-6 max-w-5xl mx-auto">
        <div className="overflow-hidden rounded-3xl border border-surface-border bg-surface-card shadow-app">
          {/* Mock browser chrome */}
          <div className="flex items-center gap-2 border-b border-surface-border bg-surface px-4 py-3">
            <span className="w-3 h-3 rounded-full bg-red-400/70" />
            <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
            <span className="w-3 h-3 rounded-full bg-accent/80" />
            <div className="mx-4 flex-1 rounded bg-surface-raised px-3 py-1 text-center text-xs text-cream-muted">
              app.budgitbuddy.io/dashboard
            </div>
          </div>
          {/* Mock dashboard */}
          <div className="grid grid-cols-3 gap-4 bg-surface p-6">
            {[
              { label: 'Net Worth', value: '$48,320', change: '+2.4%', up: true },
              { label: 'Monthly Spend', value: '$3,140', change: '-8.1%', up: false },
              { label: 'Savings Rate', value: '22%', change: '+4%', up: true },
            ].map((card) => (
              <div key={card.label} className="app-panel rounded-2xl p-4">
                <p className="mb-1 text-xs text-cream-muted">{card.label}</p>
                <p className="text-2xl font-bold text-cream">{card.value}</p>
                <p className={`mt-1 text-xs font-medium ${card.up ? 'text-accent-text dark:text-accent' : 'text-warning'}`}>
                  {card.change} this month
                </p>
              </div>
            ))}
            <div className="app-panel col-span-2 rounded-2xl p-4">
              <p className="mb-4 text-xs text-cream-muted">Monthly Spending</p>
              <div className="flex items-end gap-2 h-24">
                {[40, 65, 50, 80, 55, 90, 70, 60, 85, 45, 75, 95].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${h}%`,
                      background: i === 11 ? 'rgb(var(--app-accent))' : (i % 2 === 0 ? 'rgba(var(--app-surface-border),0.9)' : 'rgba(var(--app-surface-raised),1)'),
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-cream-muted">
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </div>
            <div className="app-panel rounded-2xl p-4">
              <p className="mb-4 text-xs text-cream-muted">Budget Status</p>
              {[
                { cat: 'Food', pct: 72 },
                { cat: 'Transport', pct: 45 },
                { cat: 'Entertainment', pct: 91 },
              ].map((b) => (
                <div key={b.cat} className="mb-3">
                  <div className="mb-1 flex justify-between text-[11px] text-cream-muted">
                    <span>{b.cat}</span>
                    <span>{b.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-raised overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${b.pct}%`,
                        background: b.pct >= 90 ? 'rgb(var(--app-warning))' : 'rgb(var(--app-accent))',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-28 px-6 max-w-6xl mx-auto">
        <h2 className="mb-2 text-3xl font-extrabold text-cream md:text-4xl">Financial superpowers</h2>
        <p className="mb-14 text-cream-muted">Everything you need to grow your net worth, all in one place.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="app-panel rounded-3xl p-7 transition-all hover:border-cream-muted/30"
            >
              <div className="mb-4">{f.icon}</div>
              <h3 className="mb-2 text-lg font-bold text-cream">{f.title}</h3>
              <p className="text-sm leading-relaxed text-cream-muted">{f.description}</p>
              {f.highlight}
            </div>
          ))}
          <BuddyCard />
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="border-y border-surface-border bg-surface/60 px-6 py-16 transition-colors">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-extrabold text-cream">{s.value}</p>
              <p className="mt-1 text-sm text-cream-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="py-28 px-6">
        <div className="app-panel mx-auto max-w-2xl rounded-3xl p-14 text-center">
          <h2 className="mb-4 text-3xl font-extrabold text-cream md:text-4xl">Ready to take control?</h2>
          <p className="mb-10 leading-relaxed text-cream-muted">
            Join thousands of people who have simplified their finances and achieved their goals with BudgIt Buddy.
          </p>
          <Link
            href="/signup"
            className="inline-block rounded-xl bg-accent px-8 py-3.5 font-bold text-accent-contrast transition-colors shadow-md shadow-[rgba(var(--app-accent),0.2)] hover:bg-accent-hover"
          >
            Get Started for Free
          </Link>
          <p className="mt-4 text-xs text-cream-muted">No credit card required. Cancel anytime.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-border px-6 py-8 transition-colors">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="BudgIt Buddy" width={20} height={20} className="rounded" />
            <span className="text-sm font-semibold"><span className="text-accent">BudgIt</span> <span className="text-warning-display">Buddy</span></span>
          </div>
          <div className="flex items-center gap-6 text-xs text-cream-muted">
            <a href="#" className="transition-colors hover:text-cream">Privacy Policy</a>
            <a href="#" className="transition-colors hover:text-cream">Terms of Service</a>
            <a href="#" className="transition-colors hover:text-cream">Security</a>
            <a href="#" className="transition-colors hover:text-cream">Status</a>
          </div>
          <p className="text-xs text-cream-muted">© 2024 BudgIt Buddy. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}
