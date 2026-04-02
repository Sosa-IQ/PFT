'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { PieChart, Pie, Cell } from 'recharts'
import ThemeToggle from '@/components/ThemeToggle'

// ── Contact form ──────────────────────────────────────────────────────────────

const CONTACT_SUBJECTS = ['Feature Request', 'Bug Report', 'Support', 'Other'] as const

function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contact/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong.')
        setStatus('error')
      } else {
        setStatus('success')
        setForm({ name: '', email: '', subject: '', message: '' })
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  return (
    <section id="contact" className="py-28 px-6">
      <div className="app-panel mx-auto max-w-2xl rounded-3xl p-10 md:p-14">
        <h2 className="mb-2 text-3xl font-extrabold text-cream md:text-4xl">Get in touch</h2>
        <p className="mb-10 text-cream-muted leading-relaxed">
          Have a question, spotted a bug, or want to share an idea? We&apos;d love to hear from you.
        </p>

        {status === 'success' ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
              <svg className="h-7 w-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-cream">Message sent!</h3>
            <p className="max-w-sm text-sm text-cream-muted">
              Thanks for reaching out. Check your inbox — we&apos;ve sent a confirmation to your email and will follow up soon.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="mt-2 text-sm text-accent-text underline underline-offset-2 transition-colors hover:text-accent dark:text-accent"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-cream-muted">
                  Name
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-cream placeholder-cream-muted/50 outline-none transition-colors focus:border-accent/60 focus:ring-1 focus:ring-accent/30"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-cream-muted">
                  Email
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-cream placeholder-cream-muted/50 outline-none transition-colors focus:border-accent/60 focus:ring-1 focus:ring-accent/30"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-subject" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-cream-muted">
                Subject
              </label>
              <select
                id="contact-subject"
                name="subject"
                required
                value={form.subject}
                onChange={handleChange}
                className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-accent/60 focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
              >
                <option value="" disabled>Select a subject…</option>
                {CONTACT_SUBJECTS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="contact-message" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-cream-muted">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={5}
                value={form.message}
                onChange={handleChange}
                placeholder="Tell us what's on your mind…"
                className="w-full resize-none rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-cream placeholder-cream-muted/50 outline-none transition-colors focus:border-accent/60 focus:ring-1 focus:ring-accent/30"
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-red-400">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast shadow-md shadow-[rgba(var(--app-accent),0.2)] transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'submitting' ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

// ── Feature cards ────────────────────────────────────────────────────────────

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
      <div className="mt-4 space-y-2">
        {[
          { label: '−$86.42 · Groceries',     pulse: true  },
          { label: '−$14.75 · Dining',         pulse: false },
          { label: '−$9.99 · Entertainment',   pulse: false },
        ].map(({ label, pulse }, i) => (
          <div key={i} className="flex w-fit items-center gap-3 rounded-xl border border-surface-border bg-surface px-4 py-2.5">
            <span className={`h-2 w-2 rounded-full bg-accent${pulse ? ' animate-pulse' : ' opacity-40'}`} />
            <span className="font-mono text-sm text-cream-muted">{label}</span>
          </div>
        ))}
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
    description: 'Your financial data is kept private and secure. We connect to your bank through Plaid — a trusted service used by millions — and only you can ever see your accounts and transactions.',
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
    description: 'Set monthly budgets per category and watch your spending in real time. Always know exactly how much you have left before you hit your limit.',
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

function BuddyCard() {
  return (
    <div className="app-panel md:col-span-2 flex items-center justify-between gap-6 rounded-3xl border-accent/20 bg-gradient-to-br from-accent/10 via-surface-card to-warning/10 p-7">
      <div className="flex-1">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent-text dark:text-accent">Your Money&apos;s Buddy</p>
        <h3 className="mb-3 text-xl font-bold text-cream">Say hello to Budgy</h3>
        <p className="max-w-sm text-sm leading-relaxed text-cream-muted">
          Budgy is your personal finance companion. He&apos;s always by your side as you track
          spending, hit your savings goals, and build a healthier relationship with your money — one dollar at a time.
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

// ── Mock dashboard data ───────────────────────────────────────────────────────

const CHART_COLORS = ['#67e7a9', '#f1db8f', '#8ea2ff', '#ff8b88', '#78d7ff']

const mockSpending = [
  { category: 'Groceries', total: 420 },
  { category: 'Dining', total: 280 },
  { category: 'Transport', total: 180 },
  { category: 'Shopping', total: 175 },
  { category: 'Entertainment', total: 150 },
]

const mockTransactions = [
  { date: 'Apr 1',  merchant: 'Whole Foods Market', category: 'Groceries',     amount: 86.42,  catIdx: 0 },
  { date: 'Mar 31', merchant: 'Spotify Premium',    category: 'Entertainment', amount: 9.99,   catIdx: 4, recurring: true },
  { date: 'Mar 31', merchant: 'Shell Gas Station',  category: 'Transport',     amount: 52.30,  catIdx: 2 },
  { date: 'Mar 30', merchant: 'Chipotle',           category: 'Dining',        amount: 14.75,  catIdx: 1 },
]

const mockBudgets = [
  { cat: 'Groceries',     pct: 70 },
  { cat: 'Dining',        pct: 56 },
  { cat: 'Transport',     pct: 72 },
  { cat: 'Entertainment', pct: 75 },
]

function MockDashboardPreview() {
  return (
    <section className="px-6 max-w-5xl mx-auto">
      <div className="overflow-hidden rounded-3xl border border-surface-border bg-surface-card shadow-app">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-surface-border bg-surface px-4 py-3">
          <span className="w-3 h-3 rounded-full bg-red-400/70" />
          <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
          <span className="w-3 h-3 rounded-full bg-accent/80" />
          <div className="mx-4 flex-1 rounded bg-surface-raised px-3 py-1 text-center text-xs text-cream-muted">
            app.budgitbuddy.io/dashboard
          </div>
        </div>

        {/* App UI */}
        <div className="flex bg-surface h-[420px]">

          {/* Sidebar */}
          <div className="w-44 shrink-0 flex flex-col border-r border-surface-border/80 bg-surface-sidebar py-4 px-3">
            <div className="mb-5 flex items-center gap-1.5 px-1">
              <div className="h-8 w-8 rounded-lg bg-surface-raised ring-1 ring-surface-border overflow-hidden flex items-center justify-center">
                <Image src="/BudgitBuddy.png" alt="" width={22} height={22} className="object-contain" />
              </div>
              <div className="leading-none">
                <div className="text-sm font-bold text-accent">BudgIt</div>
                <div className="text-sm font-bold text-warning-display">Buddy</div>
              </div>
            </div>
            <ul className="flex-1 space-y-1">
              {[
                { label: 'Dashboard',    icon: '✦', active: true  },
                { label: 'Transactions', icon: '↺', active: false },
                { label: 'Budgets',      icon: '◫', active: false },
                { label: 'Goals',        icon: '◎', active: false },
                { label: 'Liabilities',  icon: '◌', active: false },
                { label: 'Settings',     icon: '⚙', active: false },
              ].map(({ label, icon, active }) => (
                <li key={label}>
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                    active
                      ? 'bg-gradient-to-r from-accent to-accent-hover text-accent-contrast'
                      : 'text-cream-muted'
                  }`}>
                    <span className="text-sm leading-none">{icon}</span>
                    {label}
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-surface-border pt-3">
              <p className="px-1 text-[9px] uppercase tracking-widest text-cream-muted/60 truncate">alex@example.com</p>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-hidden p-4 space-y-3">
            <h1 className="text-sm font-semibold text-cream">Dashboard</h1>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Net Worth',    value: '$48,320', color: 'text-accent-text dark:text-accent' },
                { label: 'Total Assets', value: '$62,150', color: 'text-accent-text dark:text-accent' },
                { label: 'Total Debt',   value: '$13,830', color: 'text-warning-display' },
              ].map((card) => (
                <div key={card.label} className="app-panel rounded-xl p-3">
                  <p className="text-[9px] text-cream-muted mb-0.5">{card.label}</p>
                  <p className={`text-sm font-bold ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Spending + Budgets */}
            <div className="grid grid-cols-5 gap-2.5">
              {/* Spending pie */}
              <div className="col-span-3 app-panel rounded-xl p-3">
                <p className="text-[10px] font-semibold text-cream mb-2">Spending — This Month</p>
                <div className="flex items-center gap-3">
                  <div className="shrink-0">
                    <PieChart width={100} height={100}>
                      <Pie
                        data={mockSpending}
                        dataKey="total"
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={46}
                        paddingAngle={2}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {mockSpending.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {mockSpending.map((d, i) => (
                      <div key={d.category} className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i] }} />
                        <span className="text-[10px] text-cream-muted flex-1 truncate">{d.category}</span>
                        <span className="text-[10px] font-semibold text-cream">${d.total}</span>
                      </div>
                    ))}
                    <p className="text-[9px] text-cream-muted pt-1">Total: <span className="font-semibold text-cream">$1,205.00</span></p>
                  </div>
                </div>
              </div>

              {/* Budget status */}
              <div className="col-span-2 app-panel rounded-xl p-3">
                <p className="text-[10px] font-semibold text-cream mb-3">Budgets</p>
                <div className="space-y-2.5">
                  {mockBudgets.map((b) => (
                    <div key={b.cat}>
                      <div className="flex justify-between text-[9px] text-cream-muted mb-1">
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

            {/* Recent transactions */}
            <div className="app-panel rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
                <p className="text-[10px] font-semibold text-cream">Recent Transactions</p>
                <span className="text-[10px] text-accent-text dark:text-accent cursor-pointer">View all →</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-surface/60">
                    <th className="text-left px-3 py-1.5 text-[9px] font-medium text-cream-muted">Date</th>
                    <th className="text-left px-3 py-1.5 text-[9px] font-medium text-cream-muted">Merchant</th>
                    <th className="text-left px-3 py-1.5 text-[9px] font-medium text-cream-muted">Category</th>
                    <th className="text-right px-3 py-1.5 text-[9px] font-medium text-cream-muted">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {mockTransactions.map((t) => (
                    <tr key={t.merchant} className="border-t border-surface-border">
                      <td className="px-3 py-2 text-[10px] text-cream-muted whitespace-nowrap">{t.date}</td>
                      <td className="px-3 py-2 text-[10px] text-cream font-medium">
                        {t.merchant}
                        {t.recurring && (
                          <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[8px] text-accent-text dark:text-accent">recurring</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                          style={{ backgroundColor: CHART_COLORS[t.catIdx] + '28', color: CHART_COLORS[t.catIdx] }}
                        >
                          {t.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-[10px] font-medium text-warning tabular-nums">
                        ${t.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────────────────────────

const pricingTiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    badge: null,
    description: 'Everything you need to start taking control of your finances.',
    cta: 'Get Started',
    ctaHref: '/signup',
    highlighted: false,
    features: [
      '1 connected bank account',
      '30-day transaction history',
      'Up to 5 budget categories',
      'Net worth tracking',
      'Manual liability entry',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    price: '$9',
    period: '/month',
    badge: 'Most Popular',
    description: 'The full BudgIt Buddy experience for serious financial growth.',
    cta: 'Start Free Trial',
    ctaHref: '/signup',
    highlighted: true,
    features: [
      'Everything in Free',
      'Unlimited bank accounts',
      'Full transaction history',
      'Unlimited budgets & categories',
      'Savings goals tracking',
      'AI insights via Claude MCP',
      'Priority support',
    ],
  },
]

function CheckIcon() {
  return (
    <svg className="mt-0.5 w-4 h-4 shrink-0 text-accent" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

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
                href="#pricing"
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-colors hover:text-cream"
              >
                Pricing
              </a>
              <a
                href="#contact"
                className="absolute left-1/2 top-1/2 ml-8 -translate-y-1/2 transition-colors hover:text-cream sm:ml-10 md:ml-12"
              >
                Contact
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
                href="#pricing"
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2 transition-colors hover:bg-surface-hover hover:text-cream"
              >
                Pricing
              </a>
              <a
                href="#contact"
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2 transition-colors hover:bg-surface-hover hover:text-cream"
              >
                Contact
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
          Your Money Needs<br />
          <span className="text-accent">a Buddy</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-cream-muted">
          Track your income, expenses and debts while managing your budgets and goals.
          All in one simple and intuitive platform.
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
      <MockDashboardPreview />

      {/* Features */}
      <section id="features" className="py-28 px-6 max-w-6xl mx-auto">
        <h2 className="mb-2 text-3xl font-extrabold text-cream md:text-4xl">Financial superpowers</h2>
        <p className="mb-14 text-cream-muted">Everything you need to grow your net worth, all in one place.</p>
        <div className="grid md:grid-cols-2 gap-6">
          <BuddyCard />
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
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-surface-border bg-surface/60 px-6 py-20 transition-colors">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-cream md:text-4xl">Simple, honest pricing</h2>
            <p className="mt-3 text-cream-muted">Start free. Upgrade when you&apos;re ready.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 items-start">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`app-panel rounded-3xl p-8 flex flex-col ${tier.highlighted ? 'border-accent/40 ring-1 ring-accent/30' : ''}`}
              >
                {tier.badge && (
                  <span className="mb-4 self-start rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-text dark:text-accent">
                    {tier.badge}
                  </span>
                )}
                {!tier.badge && <div className="mb-4 h-6" />}
                <div className="mb-1 flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-cream">{tier.price}</span>
                  <span className="mb-1 text-sm text-cream-muted">{tier.period}</span>
                </div>
                <p className="text-xl font-bold text-cream mb-1">{tier.name}</p>
                <p className="text-sm text-cream-muted mb-7">{tier.description}</p>
                <ul className="flex-1 space-y-3 mb-8">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-cream-muted">
                      <CheckIcon />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.ctaHref}
                  className={`rounded-xl py-3 text-center text-sm font-semibold transition-colors ${
                    tier.highlighted
                      ? 'bg-accent text-accent-contrast shadow-md shadow-[rgba(var(--app-accent),0.2)] hover:bg-accent-hover'
                      : 'border border-surface-border text-cream hover:bg-surface-hover'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <ContactSection />

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
