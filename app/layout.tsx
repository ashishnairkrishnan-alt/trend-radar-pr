import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Trend Radar — Pernod Ricard ME',
  description: 'AI-powered social media trend scoring for Pernod Ricard Middle East',
}

function Header() {
  return (
    <header className="bg-[#0D1B3E] sticky top-0 z-50">

      {/* Main nav bar */}
      <div className="max-w-[1440px] mx-auto px-6 h-[68px] flex items-center justify-between">

        {/* LEFT — Logo + product title */}
        <Link href="/" className="flex items-center gap-4 group">
          {/* Logo mark in white pill — makes PR logo visible on dark bg */}
          <div className="bg-white rounded-xl px-3 py-1.5 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <img
              src="/pernod-ricard-logo.png"
              alt="Pernod Ricard"
              className="h-8 w-auto"
              style={{ display: 'block' }}
            />
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-white/15 hidden sm:block" />

          {/* Product title */}
          <div className="hidden sm:flex flex-col justify-center">
            <span
              className="text-[9px] text-white/45 uppercase font-dm-sans font-medium"
              style={{ letterSpacing: '0.2em' }}
            >
              Middle East
            </span>
            <span className="text-[20px] font-playfair font-semibold text-white leading-tight tracking-tight">
              Trend Radar
            </span>
          </div>
        </Link>

        {/* Mobile title */}
        <span className="sm:hidden text-[18px] font-playfair font-semibold text-white">
          Trend Radar
        </span>

        {/* RIGHT — Navigation links */}
        <nav className="flex items-center gap-0.5">
          <NavLink href="/">Dashboard</NavLink>
          <NavLink href="/history">History</NavLink>
          <NavLink href="/settings">Settings</NavLink>
        </nav>

      </div>

      {/* Gold accent line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent opacity-40" />

    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 rounded-lg text-[13px] font-dm-sans font-medium text-white/55 hover:text-white hover:bg-white/[0.07] transition-all duration-150"
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
