'use client'

import { useState } from 'react'
import { DIGEST_RECIPIENTS, KEYWORD_CLUSTERS, APP_CONFIG, BRANDS } from '@/lib/config'

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg shadow-card border-l-[3px] border-pr-gold overflow-hidden">
      <div className="px-6 py-4 border-b border-pr-bg">
        <h2 className="text-sm font-bold text-pr-text uppercase tracking-widest">{title}</h2>
        {subtitle && <p className="text-xs text-pr-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
      style={{
        backgroundColor: color ? `${color}15` : '#F4F4F6',
        color: color || '#1A2B4A',
        borderColor: color ? `${color}30` : '#E5E7EB',
      }}
    >
      {children}
    </span>
  )
}

type SendState = 'idle' | 'loading' | 'done' | 'error'

function SendControls() {
  const [test, setTest] = useState<SendState>('idle')
  const [all, setAll] = useState<SendState>('idle')

  const send = async (isTest: boolean, set: (s: SendState) => void) => {
    set('loading')
    try {
      const res = await fetch(`/api/digest${isTest ? '?test=1' : ''}`, { method: 'POST' })
      set(res.ok ? 'done' : 'error')
    } catch {
      set('error')
    }
    setTimeout(() => set('idle'), 4000)
  }

  const label = (s: SendState, idle: string, done: string) =>
    s === 'idle' ? idle : s === 'loading' ? 'Sending…' : s === 'done' ? done : 'Failed — retry'

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <button
        onClick={() => send(true, setTest)}
        disabled={test === 'loading'}
        className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 border ${
          test === 'done' ? 'bg-brand-jameson text-white border-transparent'
          : test === 'error' ? 'bg-red-500 text-white border-transparent'
          : 'bg-white text-pr-navy border-pr-navy/20 hover:bg-pr-cream'
        }`}
      >
        {label(test, 'Send Test (only me)', 'Test sent!')}
      </button>
      <button
        onClick={() => send(false, setAll)}
        disabled={all === 'loading'}
        className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 ${
          all === 'done' ? 'bg-brand-jameson text-white'
          : all === 'error' ? 'bg-red-500 text-white'
          : 'bg-pr-gold text-pr-navy hover:bg-pr-gold/90'
        }`}
      >
        {label(all, 'Send to All Recipients', 'Sent to all!')}
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div>
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-widest text-pr-muted font-medium mb-1">
          Configuration
        </div>
        <h1 className="text-2xl font-serif font-bold text-pr-text">Settings</h1>
        <p className="text-sm text-pr-muted mt-0.5">
          Manage recipients, keywords, and brand configuration. Edit{' '}
          <code className="font-mono text-pr-navy bg-pr-bg px-1 rounded">lib/config.ts</code> to make changes permanent.
        </p>
      </div>

      <div className="space-y-5">
        {/* Recipients */}
        <SectionCard
          title="Email Recipients"
          subtitle="Weekly digest is sent to these addresses every Monday 8am Dubai (4am UTC)"
        >
          <SendControls />
          <div className="space-y-2 mb-4">
            {DIGEST_RECIPIENTS.map((email) => (
              <div
                key={email}
                className="flex items-center justify-between bg-pr-bg rounded-lg px-4 py-2.5"
              >
                <span className="text-sm text-pr-text font-mono">{email}</span>
                <button
                  onClick={() => handleCopy(email, email)}
                  className="text-xs text-pr-muted hover:text-pr-navy transition-colors"
                >
                  {copied === email ? 'âœ“ Copied' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-pr-muted">
            To add / remove recipients, edit{' '}
            <code className="font-mono bg-pr-bg px-1 rounded">DIGEST_RECIPIENTS</code> in{' '}
            <code className="font-mono bg-pr-bg px-1 rounded">lib/config.ts</code>.
          </p>
        </SectionCard>

        {/* Cron schedule */}
        <SectionCard
          title="Scrape & Digest Schedule"
          subtitle="Configured in vercel.json â€” runs automatically on Vercel"
        >
          <div className="space-y-3">
            {[
              { color: 'bg-brand-jameson', name: 'Apify Scraper Run', when: 'Monday 2:00 AM UTC (6:00 AM GST)', cron: '0 2 * * 1' },
              { color: 'bg-pr-gold', name: 'Instagram Trends Refresh', when: 'Monday 3:00 AM UTC (7:00 AM GST)', cron: '0 3 * * 1' },
              { color: 'bg-pr-gold', name: 'TikTok Trends Refresh', when: 'Monday 3:10 AM UTC (7:10 AM GST)', cron: '10 3 * * 1' },
              { color: 'bg-brand-glenlivet', name: 'Weekly Digest Email', when: 'Monday 4:00 AM UTC (8:00 AM GST)', cron: '0 4 * * 1' },
            ].map((row) => (
              <div key={row.cron} className="flex items-center gap-4 bg-pr-bg rounded-lg px-4 py-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${row.color}`} />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-pr-text">{row.name}</div>
                  <div className="text-xs text-pr-muted">{row.when}</div>
                </div>
                <code className="text-xs font-mono text-pr-muted bg-white px-2 py-1 rounded border">
                  {row.cron}
                </code>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Brands */}
        <SectionCard
          title="Brand Configuration"
          subtitle="Active brands scored by Claude for each trend"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BRANDS.map((brand) => {
              const active = APP_CONFIG.activeBrands.includes(brand.key)
              return (
                <div
                  key={brand.key}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                    active ? 'border-pr-gold/30 bg-pr-cream' : 'border-pr-bg bg-pr-bg opacity-50'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: brand.color }}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-pr-text">{brand.name}</div>
                    <div className="text-xs text-pr-muted mt-0.5">
                      Score field: <code className="font-mono">{brand.scoreField}</code>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      active ? 'bg-brand-jameson/10 text-brand-jameson' : 'bg-pr-muted/10 text-pr-muted'
                    }`}
                  >
                    {active ? 'Active' : 'Off'}
                  </span>
                </div>
              )
            })}
          </div>
        </SectionCard>

        {/* Keywords */}
        <SectionCard
          title="Scrape Keyword Clusters"
          subtitle="Apify actors are run against all keywords in these clusters"
        >
          <div className="space-y-4">
            {Object.entries(KEYWORD_CLUSTERS).map(([cluster, keywords]) => (
              <div key={cluster}>
                <div className="text-xs font-bold uppercase tracking-widest text-pr-muted mb-2">
                  {cluster}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <Tag key={kw}>#{kw}</Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-pr-muted mt-4">
            Edit <code className="font-mono bg-pr-bg px-1 rounded">KEYWORD_CLUSTERS</code> in{' '}
            <code className="font-mono bg-pr-bg px-1 rounded">lib/config.ts</code> to add or remove keywords.
          </p>
        </SectionCard>

        {/* API endpoints */}
        <SectionCard
          title="API Endpoints"
          subtitle="For manual testing and integration"
        >
          <div className="space-y-2">
            {[
              { method: 'GET', path: '/api/seed-ig-trends?refresh=1', desc: 'Refresh Instagram trends from Later.com' },
              { method: 'GET', path: '/api/seed-tt-trends?refresh=1', desc: 'Refresh TikTok trends from Later.com' },
              { method: 'POST', path: '/api/digest', desc: 'Send the weekly digest to all recipients now' },
              { method: 'POST', path: '/api/digest?test=1', desc: 'Send a test digest to the test address only' },
              { method: 'GET', path: '/api/debug', desc: 'Check DB row count + current week' },
            ].map((ep) => (
              <div
                key={ep.path}
                className="flex items-center gap-3 bg-pr-bg rounded-lg px-4 py-2.5"
              >
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${
                    ep.method === 'GET'
                      ? 'bg-brand-jameson/10 text-brand-jameson'
                      : 'bg-brand-glenlivet/10 text-brand-glenlivet'
                  }`}
                >
                  {ep.method}
                </span>
                <code className="text-xs font-mono text-pr-navy flex-shrink-0">{ep.path}</code>
                <span className="text-xs text-pr-muted flex-1 hidden sm:block">{ep.desc}</span>
                <button
                  onClick={() => handleCopy(ep.path, ep.path)}
                  className="text-xs text-pr-muted hover:text-pr-navy transition-colors flex-shrink-0"
                >
                  {copied === ep.path ? 'âœ“' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
