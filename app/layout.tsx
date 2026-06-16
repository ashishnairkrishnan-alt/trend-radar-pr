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
    <header className="sticky top-0 z-50 flex h-[72px] shadow-[0_1px_8px_rgba(0,0,0,0.18)]">

      {/* ── White brand section — matches Paid Media Dashboard sidebar top ── */}
      <Link
        href="/"
        className="flex items-center gap-3.5 px-6 bg-white border-r border-[#E2E6EE] min-w-[192px] shrink-0 hover:bg-[#FAFAFA] transition-colors"
      >
        <PernodRicardLogo size={44} />
        <span className="text-[14px] font-dm-sans font-semibold text-[#0D1B3E] tracking-tight leading-none">
          Pernod Ricard
        </span>
      </Link>

      {/* ── Dark navy content area — matches the Paid Media Dashboard header ── */}
      <div className="flex flex-1 items-center justify-between bg-[#0D1B3E] px-6">

        {/* Title hierarchy */}
        <div className="flex flex-col justify-center gap-[2px]">
          <span
            className="text-[9px] font-dm-sans font-medium text-white/35 uppercase"
            style={{ letterSpacing: '0.22em' }}
          >
            Pernod Ricard
          </span>
          <span className="text-[24px] font-playfair font-semibold text-white leading-none tracking-tight">
            Trend Radar
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          <NavLink href="/">Dashboard</NavLink>
          <NavLink href="/history">History</NavLink>
          <NavLink href="/settings">Settings</NavLink>
        </nav>

      </div>
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 rounded-md text-[13px] font-dm-sans font-medium text-white/55 hover:text-white hover:bg-white/[0.08] transition-all duration-150"
    >
      {children}
    </Link>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-pr-bg font-dm-sans antialiased">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
