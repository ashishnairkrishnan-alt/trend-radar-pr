'use client'

import { useState, useEffect, useCallback } from 'react'
import TrendCard from '@/components/TrendCard'
import FilterPills from '@/components/FilterPills'
import { DashboardSkeleton } from '@/components/Skeleton'
import type { ScoredTrend, BrandKey } from '@/types'
import { APP_CONFIG } from '@/lib/config'

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function EmptyState({ filtered, onReload }: { filtered: boolean; onReload: () => void }) {
  const [loading, setLoading] = useState(false)

  const handleReload = async () => {
    setLoading(true)
    try {
      // Repopulate from Later.com (safe: only clears old data after a successful scrape)
      await fetch('/api/seed-ig-trends?refresh=1')
      await fetch('/api/seed-tt-trends?refresh=1')
    } catch {
      /* surfaced via the reload below */
    }
    setLoading(false)
    onReload()
  }

  return (
    <div className="col-span-2 py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-pr-cream border border-pr-gold/20 flex items-center justify-center mx-auto mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.636 5.636a9 9 0 1 0 12.728 12.728M5.636 5.636A9 9 0 0 1 18.364 18.364M5.636 5.636 18.364 18.364" />
          <circle cx="12" cy="12" r="1" fill="#C9A84C" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-pr-text mb-2">
        {filtered ? 'No trends match your filters' : 'No trends this week yet'}
      </h3>
      <p className="text-sm text-pr-muted max-w-xs mx-auto mb-6">
        {filtered
          ? 'Try changing the brand or platform filter.'
          : 'Trends refresh automatically every Monday. You can also reload them now.'}
      </p>
      {!filtered && (
        <button
          onClick={handleReload}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pr-navy text-white text-sm font-semibold hover:bg-pr-navy/90 transition-colors disabled:opacity-60"
        >
          {loading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {loading ? 'Reloading trends…' : 'Reload trends'}
        </button>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function SendDigestButtons() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const send = async (
    test: boolean,
    setState: (s: 'idle' | 'loading' | 'done' | 'error') => void
  ) => {
    setState('loading')
    try {
      const res = await fetch(`/api/digest${test ? '?test=1' : ''}`, { method: 'POST' })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
    setTimeout(() => setState('idle'), 3000)
  }

  const testLabel = testStatus === 'idle' ? 'Send Test'
    : testStatus === 'loading' ? 'Sending…'
    : testStatus === 'done' ? 'Test sent!'
    : 'Failed'

  const label = status === 'idle' ? 'Send Digest'
    : status === 'loading' ? 'Sending…'
    : status === 'done' ? 'Sent!'
    : 'Failed'

  return (
    <div className="flex items-center gap-2">
      {/* Send Test — only to the test address */}
      <button
        onClick={() => send(true, setTestStatus)}
        disabled={testStatus === 'loading'}
        title="Send only to the test address"
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 border ${
          testStatus === 'done' ? 'bg-brand-jameson text-white border-transparent'
          : testStatus === 'error' ? 'bg-red-500 text-white border-transparent'
          : 'bg-white text-pr-navy border-pr-navy/20 hover:bg-pr-cream'
        }`}
      >
        {testStatus === 'loading' && <Spinner />}
        {testLabel}
      </button>

      {/* Send Digest — to the full recipient list */}
      <button
        onClick={() => send(false, setStatus)}
        disabled={status === 'loading'}
        title="Send to all recipients"
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 ${
          status === 'done' ? 'bg-brand-jameson text-white'
          : status === 'error' ? 'bg-red-500 text-white'
          : 'bg-pr-gold text-pr-navy hover:bg-pr-gold/90'
        }`}
      >
        {status === 'loading' && <Spinner />}
        {label}
      </button>
    </div>
  )
}

export default function DashboardPage() {
  const [trends, setTrends] = useState<ScoredTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [activeBrand, setActiveBrand] = useState<'all' | BrandKey>('all')
  const [activePlatform, setActivePlatform] = useState<'all' | 'instagram' | 'tiktok'>('all')

  const now = new Date()
  const weekNumber = getWeekNumber(now)
  const year = now.getFullYear()

  const fetchTrends = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/trends?week=${weekNumber}&year=${year}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        console.error('[dashboard] Failed to fetch trends:', json.error)
        setTrends([])
      } else {
        setTrends((json.trends as ScoredTrend[]) || [])
      }
    } catch (err) {
      console.error('[dashboard] Failed to fetch trends:', err)
      setTrends([])
    }
    setLoading(false)
  }, [weekNumber, year])

  useEffect(() => {
    fetchTrends()
  }, [fetchTrends])

  const filtered = trends.filter((t) => {
    const brandMatch =
      activeBrand === 'all' ||
      t.top_brand.toLowerCase().includes(activeBrand)
    const platformMatch = activePlatform === 'all' || t.platform === activePlatform
    return brandMatch && platformMatch
  })

  const isFiltered = activeBrand !== 'all' || activePlatform !== 'all'

  const dateLabel = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-playfair font-semibold text-pr-text">
            Trend Dashboard
          </h1>
          <p className="text-sm text-pr-muted mt-0.5">
            {'Week ' + weekNumber + ' · ' + APP_CONFIG.fiscalYear + ' · ' + dateLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-pr-muted">
            {!loading && `${filtered.length} trend${filtered.length !== 1 ? 's' : ''}`}
          </span>
          <SendDigestButtons />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-card px-4 py-3 mb-6">
        <FilterPills
          activeBrand={activeBrand}
          activePlatform={activePlatform}
          onBrandChange={setActiveBrand}
          onPlatformChange={setActivePlatform}
        />
      </div>

      {/* Content */}
      <h2 className="sr-only">This week&apos;s trends</h2>
      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.length === 0 ? (
            <EmptyState filtered={isFiltered} onReload={fetchTrends} />
          ) : (
            filtered.map((trend) => <TrendCard key={trend.id} trend={trend} />)
          )}
        </div>
      )}
    </div>
  )
}
