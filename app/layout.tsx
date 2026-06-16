import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import PernodRicardLogo from '@/components/PernodRicardLogo'

export const metadata: Metadata = {
  title: 'Trend Radar — Pernod Ricard ME',
  description: 'AI-powered social media trend scoring for Pernod Ricard Middle East',
}

function Header() {
  return (
    <header className="bg-pr-navy sticky top-0 z-50" style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between px-6 h-16">

        {/* Left — Logo + brand name (matches Paid Media Dashboard sidebar header) */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <PernodRicardLogo size={34} />
          <div className="hidden sm:block border-l border-white/15 pl-3">
            <p
              className="text-[9px] font-dm-sans font-500 text-white/50 uppercase tracking-[0.18em] leading-none mb-0.5"
              style={{ letterSpacing: '0.18em' }}
            >
              Pernod Ricard
            </p>
            <h1
              className="text-[17px] font-playfair font-semibold text-white leading-none tracking-tight"
            >
              Trend Radar
            </h1>
          </div>
        </Link>

        {/* Centre — visible on mobile only (logo hidden on mobile) */}
        <Link href="/" className="sm:hidden">
          <h1 className="text-[16px] font-playfair font-semibold text-white tracking-tight">
            Trend Radar
          </h1>
        </Link>

        {/* Right — Navigation */}
        <nav className="flex items-center gap-1">
          <NavLink href="/">Dashboard</NavLink>
          <NavLink href="/history">History</NavLink>
          <NavLink href="/settings">Settings</NavLink>
        </nav>

      </div>

      {/* Thin gold underline accent — matching the gold KPI accents in the dashboard */}
      <div className="h-px bg-gradient-to-r from-transparent via-pr-gold/40 to-transparent" />
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded text-[13px] font-dm-sans font-medium text-white/60 hover:text-white hover:bg-white/8 transition-colors"
      style={{ letterSpacing: '0.01em' }}
    >
      {children}
    </Link>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-pr-bg font-dm-sans">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
