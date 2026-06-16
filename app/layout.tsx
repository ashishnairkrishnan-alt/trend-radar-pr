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
    <header className="bg-[#0D1B3E] sticky top-0 z-50">
      <div className="max-w-[1440px] mx-auto px-6 h-[68px] flex items-center justify-between">

        {/* LEFT — Logo + product name */}
        <Link href="/" className="flex items-center gap-4 group">

          {/* SVG logo on white rounded background so it reads clearly on dark navy */}
          <div className="bg-white rounded-2xl px-3 py-2 shadow-sm group-hover:shadow-md transition-shadow duration-200">
            <PernodRicardLogo size={38} />
          </div>

          {/* Vertical divider */}
          <div className="hidden sm:block h-9 w-px bg-white/15" />

          {/* Title block */}
          <div className="hidden sm:flex flex-col leading-none gap-[3px]">
            <span
              className="text-[9px] font-dm-sans font-medium uppercase text-white/40"
              style={{ letterSpacing: '0.22em' }}
            >
              Pernod Ricard
            </span>
            <span className="text-[19px] font-playfair font-semibold text-white tracking-tight">
              Trend Radar
            </span>
          </div>
        </Link>

        {/* Mobile: title only */}
        <span className="sm:hidden text-[17px] font-playfair font-semibold text-white">
          Trend Radar
        </span>

        {/* RIGHT — Nav */}
        <nav className="flex items-center gap-0.5">
          <NavLink href="/">Dashboard</NavLink>
          <NavLink href="/history">History</NavLink>
          <NavLink href="/settings">Settings</NavLink>
        </nav>

      </div>

      {/* Thin gold underline */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 rounded-lg text-[13px] font-dm-sans font-medium text-white/55 hover:text-white hover:bg-white/[0.08] transition-all duration-150"
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
