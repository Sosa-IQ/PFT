import Link from 'next/link'
import Image from 'next/image'
import ThemeToggle from '@/components/ThemeToggle'

const features = [
  {
    icon: (
      <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: 'Real-time tracking',
    description: 'Connect your bank via Plaid and watch every transaction sync instantly. Every dollar categorized and accounted for automatically.',
    highlight: (
      <div className="mt-4 flex items-center gap-3 bg-gray-100 dark:bg-zinc-900 rounded-lg px-4 py-2.5 w-fit border border-gray-200 dark:border-zinc-800">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm text-gray-600 dark:text-zinc-300 font-mono">−$42.00 · Groceries</span>
      </div>
    ),
  },
  {
    icon: (
      <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Secure connections',
    description: 'Bank-level 256-bit encryption. Your data is yours — stored in Supabase with row-level security enforced for every query.',
    highlight: (
      <div className="mt-4 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
        </svg>
        ENCRYPTION ACTIVE
      </div>
    ),
  },
  {
    icon: (
      <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: 'Smart budgets',
    description: 'Set monthly budgets per category, track spending in real time, and get notified before you overspend.',
    highlight: null,
  },
  {
    icon: (
      <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
    <div className="md:col-span-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-7 flex items-center justify-between gap-6 shadow-sm">
      <div className="flex-1">
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">Meet your Buddy</p>
        <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">A Buddy who cares</h3>
        <p className="text-gray-500 dark:text-zinc-400 text-sm leading-relaxed max-w-sm">
          Your mascot doesn&apos;t just look cute — it nudges you when you&apos;re over budget
          and celebrates your wins. Financial wellness with a personality.
        </p>
      </div>
      <div className="shrink-0">
        <Image
          src="/BudgitBuddy.png"
          alt="Budgit Buddy mascot"
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
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0c0c0c] text-gray-900 dark:text-white transition-colors duration-200">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-gray-200 dark:border-white/5 bg-white/80 dark:bg-[#0c0c0c]/80 backdrop-blur-md transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="Budgit Buddy" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-bold tracking-tight">Budgit Buddy</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-500 dark:text-zinc-400">
            <a href="#features" className="text-emerald-600 dark:text-emerald-400 font-medium hover:text-emerald-500 transition-colors">Features</a>
            <a href="#stats" className="hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</a>
            <a href="#cta" className="hover:text-gray-900 dark:hover:text-white transition-colors">About</a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-emerald-400 text-black px-4 py-2 rounded-lg hover:bg-emerald-300 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-full px-4 py-1.5 text-xs text-gray-500 dark:text-zinc-400 mb-8 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Your financial co-pilot is here
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight max-w-3xl mx-auto text-gray-900 dark:text-white">
          Master Your Money<br />
          <span className="text-emerald-500 dark:text-emerald-400">with a Buddy</span>
        </h1>
        <p className="mt-6 text-lg text-gray-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
          The editorial financial dashboard that turns complex spreadsheets
          into a beautiful, intuitive journey toward wealth.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/signup"
            className="bg-emerald-400 text-black font-semibold px-7 py-3 rounded-xl hover:bg-emerald-300 transition-colors text-sm shadow-md shadow-emerald-400/20"
          >
            Start for Free
          </Link>
          <Link
            href="/login"
            className="border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-white font-semibold px-7 py-3 rounded-xl hover:border-gray-400 dark:hover:border-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors text-sm"
          >
            View Demo
          </Link>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="px-6 max-w-5xl mx-auto">
        <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl shadow-black/10 dark:shadow-black/60">
          {/* Mock browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-900">
            <span className="w-3 h-3 rounded-full bg-red-400/70" />
            <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
            <span className="w-3 h-3 rounded-full bg-emerald-400/70" />
            <div className="flex-1 mx-4 bg-gray-200 dark:bg-zinc-800 rounded px-3 py-1 text-xs text-gray-400 dark:text-zinc-500 text-center">
              app.budgitbuddy.io/dashboard
            </div>
          </div>
          {/* Mock dashboard */}
          <div className="p-6 grid grid-cols-3 gap-4 bg-gray-50 dark:bg-zinc-950">
            {[
              { label: 'Net Worth', value: '$48,320', change: '+2.4%', up: true },
              { label: 'Monthly Spend', value: '$3,140', change: '-8.1%', up: false },
              { label: 'Savings Rate', value: '22%', change: '+4%', up: true },
            ].map((card) => (
              <div key={card.label} className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                <p className={`text-xs mt-1 font-medium ${card.up ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                  {card.change} this month
                </p>
              </div>
            ))}
            <div className="col-span-2 bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800 shadow-sm">
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">Monthly Spending</p>
              <div className="flex items-end gap-2 h-24">
                {[40, 65, 50, 80, 55, 90, 70, 60, 85, 45, 75, 95].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${h}%`,
                      background: i === 11 ? '#34d399' : (i % 2 === 0 ? '#e5e7eb' : '#d1d5db'),
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-gray-400 dark:text-zinc-600">
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800 shadow-sm">
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">Budget Status</p>
              {[
                { cat: 'Food', pct: 72 },
                { cat: 'Transport', pct: 45 },
                { cat: 'Entertainment', pct: 91 },
              ].map((b) => (
                <div key={b.cat} className="mb-3">
                  <div className="flex justify-between text-[11px] text-gray-500 dark:text-zinc-400 mb-1">
                    <span>{b.cat}</span>
                    <span>{b.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${b.pct}%`,
                        background: b.pct >= 90 ? '#f87171' : '#34d399',
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
        <h2 className="text-3xl md:text-4xl font-extrabold mb-2 text-gray-900 dark:text-white">Financial superpowers</h2>
        <p className="text-gray-500 dark:text-zinc-400 mb-14">Everything you need to grow your net worth, all in one place.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800 rounded-2xl p-7 hover:border-gray-300 dark:hover:border-zinc-700 shadow-sm hover:shadow-md transition-all"
            >
              <div className="mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{f.title}</h3>
              <p className="text-gray-500 dark:text-zinc-400 text-sm leading-relaxed">{f.description}</p>
              {f.highlight}
            </div>
          ))}
          <BuddyCard />
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="py-16 px-6 border-y border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-950/50 transition-colors">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="py-28 px-6">
        <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-14 text-center shadow-xl shadow-black/5 dark:shadow-black/40">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4 text-gray-900 dark:text-white">Ready to take control?</h2>
          <p className="text-gray-500 dark:text-zinc-400 mb-10 leading-relaxed">
            Join thousands of people who have simplified their finances and achieved their goals with Budgit Buddy.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-emerald-400 text-black font-bold px-8 py-3.5 rounded-xl hover:bg-emerald-300 transition-colors shadow-md shadow-emerald-400/20"
          >
            Get Started for Free
          </Link>
          <p className="mt-4 text-xs text-gray-400 dark:text-zinc-600">No credit card required. Cancel anytime.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-zinc-800 py-8 px-6 transition-colors">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="Budgit Buddy" width={20} height={20} className="rounded" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Budgit Buddy</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-400 dark:text-zinc-600">
            <a href="#" className="hover:text-gray-700 dark:hover:text-zinc-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-700 dark:hover:text-zinc-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-gray-700 dark:hover:text-zinc-400 transition-colors">Security</a>
            <a href="#" className="hover:text-gray-700 dark:hover:text-zinc-400 transition-colors">Status</a>
          </div>
          <p className="text-xs text-gray-400 dark:text-zinc-600">© 2024 Budgit Buddy. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}
