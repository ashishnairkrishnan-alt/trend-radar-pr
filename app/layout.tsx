import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Trend Radar — Pernod Ricard ME',
  description: 'AI-powered social media trend scoring for Pernod Ricard Middle East',
}

function Navbar() {
  return (
    <header className="bg-pr-navy text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-7 h-7 rounded-full bg-pr-gold flex items-center justify-center">
            <span className="text-pr-navy text-xs font-black">TR</span>
          </div>
          <span className="font-serif text-lg font-bold tracking-tight">Trend Radar</span>
          <span className="hidden sm:inline-block text-[10px] text-pr-gold/70 uppercase tracking-widest mt-0.5 font-medium">
            Pernod Ricard ME
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="px-3 py-1.5 rounded text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/history"
            className="px-3 py-1.5 rounded text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            History
          </Link>
          <Link
            href="/settings"
            className="px-3 py-1.5 rounded text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            Settings
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-pr-bg">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
