'use client'

import { useState, useEffect, useCallback } from 'react'

// Isolated preview (format-classify branch). Trend names are read from roundup
// SLIDE IMAGES with vision, then presented as our own briefs with independent
// search links. No source handle, caption, image or post link is shown.

type BrandKey = 'chivas' | 'absolut' | 'jameson' | 'glenlivet'

interface Trend {
  trend_name: string
  description: string
  format: 'Carousel' | 'Static'
  turnaround: { label: string; level: string }
  top_brand: BrandKey
  brands: Record<BrandKey, { score: number; angle: string }>
  googleImages: string
}

const BRANDS: { key: BrandKey; name: string; color: string }[] = [
  { key: 'chivas', name: 'Chivas Regal', color: '#F5A623' },
  { key: 'absolut', name: 'Absolut Vodka', color: '#8A94A6' },
  { key: 'jameson', name: 'Jameson', color: '#4CAF72' },
  { key: 'glenlivet', name: 'The Glenlivet', color: '#2E7D52' },
]
const brandName = (k: BrandKey) => BRANDS.find((b) => b.key === k)?.name || k
const FMT_COLOR: Record<string, string> = { Carousel: '#3B82F6', Static: '#16A34A' }
const TURN_COLOR: Record<string, string> = { fast: '#16A34A', medium: '#D97706' }

export default function FormatPreviewPage() {
  const [trends, setTrends] = useState<Trend[]>([])
  const [counts, setCounts] = useState<{ carousel?: number; static?: number }>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandKey>('chivas')
  const [fmt, setFmt] = useState<'all' | 'Carousel' | 'Static'>('all')
  const [generating, setGenerating] = useState(false)
  const [sendMsg, setSendMsg] = useState<string | null>(null)

  // Fast read of the STORED trends (no scrape) — instant load.
  const run = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/format-trends')
      const json = await res.json()
      if (!res.ok || !json.success) setError(json.error || 'Failed')
      else { setTrends(json.trends || []); setCounts(json.counts || {}) }
    } catch (e) { setError(String(e)) }
    setLoading(false)
  }, [])

  useEffect(() => { run() }, [run])

  // Regenerate this week's trends (the slow scrape+vision) then re-read storage.
  const regenerate = useCallback(async () => {
    setGenerating(true); setError(null)
    try {
      const res = await fetch('/api/cron/format-generate')
      const json = await res.json()
      if (!res.ok || !json.success) setError(json.error || 'Generation failed')
    } catch (e) { setError(String(e)) }
    setGenerating(false)
    run()
  }, [run])

  const sendEmail = useCallback(async (test: boolean) => {
    setSendMsg(test ? 'Sending test…' : 'Sending to all…')
    try {
      const res = await fetch(`/api/digest-formats${test ? '?test=1' : ''}`, { method: 'POST' })
      const json = await res.json()
      setSendMsg(res.ok && json.success ? (test ? 'Test sent ✓' : 'Sent to all ✓') : `Failed: ${json.error || ''}`)
    } catch (e) { setSendMsg(`Failed: ${String(e)}`) }
    setTimeout(() => setSendMsg(null), 5000)
  }, [])

  const active = BRANDS.find((b) => b.key === brand)!
  const shown = trends.filter((t) => fmt === 'all' || t.format === fmt)

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 60px', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div style={{ marginBottom: 8, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9CA3AF' }}>
        Isolated Preview · not live · read-only
      </div>
      <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 26, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px' }}>
        Static &amp; Carousel Trends
      </h1>
      <p style={{ fontSize: 13, color: '#6B7280', maxWidth: 820, lineHeight: 1.5, margin: '0 0 14px' }}>
        Trend names are read from monthly roundup slides, written up as <b>your own per-brand briefs</b>, and stored
        weekly so this page loads instantly. Each card scores brand fit and links to real examples. This is the same
        data the <b>Monday Static &amp; Carousel email</b> sends.
      </p>

      {/* Generate + email controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <button onClick={regenerate} disabled={generating}
          style={{ border: '1px solid #0D1B3E', background: '#0D1B3E', color: '#fff', fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', opacity: generating ? 0.6 : 1 }}>
          {generating ? 'Generating… (1–3 min)' : '↻ Regenerate this week'}
        </button>
        <button onClick={() => sendEmail(true)}
          style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#1A2B4A', fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
          Send Test (me)
        </button>
        <button onClick={() => sendEmail(false)}
          style={{ border: '1px solid #C9A84C', background: '#C9A84C', color: '#0D1B3E', fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
          Send to all recipients
        </button>
        {sendMsg && <span style={{ fontSize: 12, color: sendMsg.startsWith('Failed') ? '#DC2626' : '#16A34A', fontWeight: 600 }}>{sendMsg}</span>}
      </div>

      {/* Brand lens */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginRight: 4 }}>Brand lens</span>
        {BRANDS.map((b) => (
          <button key={b.key} onClick={() => setBrand(b.key)}
            style={{
              border: '1px solid ' + (brand === b.key ? b.color : '#E5E7EB'),
              background: brand === b.key ? b.color : '#fff', color: brand === b.key ? '#fff' : '#1A2B4A',
              fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: brand === b.key ? '#fff' : b.color }} />
            {b.name}
          </button>
        ))}
        <button onClick={run} disabled={loading}
          style={{ marginLeft: 'auto', border: '1px solid #E5E7EB', background: '#fff', color: '#1A2B4A', fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Working…' : '↻ Refresh'}
        </button>
      </div>

      {/* Format filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9CA3AF' }}>Format</span>
        {([['all', 'All'], ['Static', 'Static'], ['Carousel', 'Carousel']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setFmt(v)}
            style={{
              border: '1px solid ' + (fmt === v ? '#0D1B3E' : '#E5E7EB'),
              background: fmt === v ? '#0D1B3E' : '#fff', color: fmt === v ? '#fff' : '#1A2B4A',
              fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {label}{v !== 'all' && counts[v.toLowerCase() as 'carousel' | 'static'] != null ? ` · ${counts[v.toLowerCase() as 'carousel' | 'static']}` : ''}
          </button>
        ))}
      </div>

      {(loading || generating) && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#6B7280' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', marginBottom: 6 }}>
            {generating ? 'Generating this week’s trends…' : 'Loading…'}
          </div>
          <div style={{ fontSize: 13 }}>
            {generating ? 'Scraping and reading slides with vision — 1–3 minutes. This runs once, then it’s stored.' : 'Reading stored trends.'}
          </div>
        </div>
      )}

      {error && !loading && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 12, padding: 20, fontSize: 13 }}>
          <b>Failed:</b> {error}
          <div style={{ marginTop: 8 }}>
            <button onClick={run} style={{ border: '1px solid #B91C1C', background: '#fff', color: '#B91C1C', fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>Try again</button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
          {shown.map((t, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, borderLeft: '3px solid ' + active.color, boxShadow: '0 1px 5px rgba(0,0,0,.07)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: 17, fontWeight: 700, color: '#1A2B4A', margin: 0, lineHeight: 1.25 }}>{t.trend_name}</h3>
              <p style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.45, margin: 0 }}>{t.description}</p>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: (FMT_COLOR[t.format] || '#888') + '1A', color: FMT_COLOR[t.format] || '#888' }}>{t.format}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: (TURN_COLOR[t.turnaround.level] || '#888') + '1A', color: TURN_COLOR[t.turnaround.level] || '#888' }}>{t.turnaround.label}</span>
                {/* Best-fit brand for this trend */}
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: (BRANDS.find((b) => b.key === t.top_brand)?.color || '#888') + '1A', color: BRANDS.find((b) => b.key === t.top_brand)?.color || '#888' }}>
                  ★ Best fit: {brandName(t.top_brand)}
                </span>
              </div>

              <div style={{ background: '#F8F9FB', borderRadius: 9, padding: '11px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9CA3AF' }}>{active.name} angle</span>
                  {/* Fit score for the selected brand */}
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: (t.brands[brand]?.score ?? 0) >= 4 ? '#16A34A' : (t.brands[brand]?.score ?? 0) >= 3 ? '#D97706' : '#9CA3AF' }}>
                    {t.brands[brand]?.score ?? '—'}/5 fit
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#1A2B4A', fontStyle: 'italic', lineHeight: 1.4 }}>&ldquo;{t.brands[brand]?.angle || '—'}&rdquo;</div>
              </div>

              <div>
                <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9CA3AF', marginBottom: 6 }}>See real examples</div>
                <a href={t.googleImages} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#fff', background: '#4285F4', padding: '7px 14px', borderRadius: 8, textDecoration: 'none' }}>
                  See on Google Images ↗
                </a>
              </div>
            </div>
          ))}
          {shown.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: 13 }}>
              {trends.length === 0
                ? 'No trends stored for this week yet. Click “Regenerate this week” above to pull them (runs once, ~1–3 min).'
                : 'Nothing in this view — try another format.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
