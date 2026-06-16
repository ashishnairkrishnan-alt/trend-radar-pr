import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Trend Radar — Pernod Ricard ME',
  description: 'AI-powered social media trend scoring for Pernod Ricard Middle East',
}

function Header() {
  return (
    <header className="sticky top-0 z-50 flex h-[70px]" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.22)' }}>

      {/* White section — logo + brand name, like the Paid Media Dashboard sidebar */}
      <Link
        href="/"
        className="flex items-center gap-3.5 px-6 bg-white shrink-0 border-r border-[#DDE1EA] hover:bg-slate-50 transition-colors duration-150"
        style={{ minWidth: 200 }}
      >
        {/* Use the real PNG logo from /public/logo.png */}
        <img
          src="/logo.png"
          alt="Pernod Ricard"
          style={{ height: 44, width: 'auto', display: 'block' }}
        />
      </Link>

      {/* Dark navy section — product title + nav */}
      <div
        className="flex flex-1 items-center justify-between px-7"
        style={{ background: '#0D1B3E' }}
      >
        {/* Title — Playfair Display, matching "Paid Media Dashboard" style */}
        <div>
          <p style={{
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontWeight: 500,
            fontSize: 10,
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            marginBottom: 3,
          }}>
            Middle East
          </p>
          <p style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontWeight: 600,
            fontSize: 26,
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            Trend Radar
          </p>
        </div>

        {/* Nav links */}
        <nav style={{ display: 'flex', gap: 4 }}>
          {[
            { label: 'Dashboard', href: '/' },
            { label: 'History', href: '/history' },
            { label: 'Settings', href: '/settings' },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontWeight: 500,
                fontSize: 13.5,
                color: 'rgba(255,255,255,0.6)',
                padding: '8px 16px',
                borderRadius: 8,
                textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

    </header>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-pr-bg antialiased" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
