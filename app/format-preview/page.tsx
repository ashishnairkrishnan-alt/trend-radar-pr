'use client'

import { useState, useEffect, useCallback } from 'react'

// Isolated preview (format-classify branch). Trend names are read from roundup
// SLIDE IMAGES with vision, then presented as our own briefs with independent
// search links. No source handle, caption, image or post link is shown.

type BrandKey = 'chivas' | 'absolut' | 'jameson' | 'glenlivet'

interface Trend {
  trend_name: string
  description: string
  keyword: string
  format: 'Carousel' | 'Static'
  turnaround: { label: string; level: string }
  brands: Record<BrandKey, string>
  links: { google: string; pinterest: string }
  examples: { title: string; link: string; source: string; thumbnail: string }[]
}

const BRANDS: { key: BrandKey; name: string; color: string }[] = [
  { key: 'chivas', name: 'Chivas Regal', color: '#F5A623' },
  { key: 'absolut', name: 'Absolut Vodka', color: '#8A94A6' },
  { key: 'jameson', name: 'Jameson', color: '#4CAF72' },
  { key: 'glenlivet', name: 'The Glenlivet', color: '#2E7D52' },
]
const FMT_COLOR: Record<string, string> = { Carousel: '#3B82F6', Static: '#16A34A' }
const TURN_COLOR: Record<string, string> = { fast: '#16A34A', medium: '#D97706' }

export default function FormatPreviewPage() {
  const [trends, setTrends] = useState<Trend[]>([])
  const [counts, setCounts] = useState<{ carousel?: number; static?: number }>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandKey>('chivas')
  const [fmt, setFmt] = useState<'all' | 'Carousel' | 'Static'>('all')

  const run = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/preview-formats')
      const json = await res.json()
      if (!res.ok || !json.success) setError(json.error || 'Failed')
      else { setTrends(json.trends || []); setCounts(json.counts || {}) }
    } catch (e) { setError(String(e)) }
    setLoading(false)
  }, [])

  useEffect(() => { run() }, [run])

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
      <p style={{ fontSize: 13, color: '#6B7280', maxWidth: 800, lineHeight: 1.5, margin: '0 0 18px' }}>
        Trend names are read from monthly roundup slides, then written up as <b>your own briefs</b> — no source content,
        handle or post is shown. Each card links out so you can find <b>real examples yourself</b>. Pick a
        <b> brand lens</b> to see how that brand would execute it.
      </p>

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

      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#6B7280' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', marginBottom: 6 }}>Reading trend slides…</div>
          <div style={{ fontSize: 13 }}>Pulling roundup slides and reading each one with vision — 1–3 minutes.</div>
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
              </div>

              <div style={{ background: '#F8F9FB', borderRadius: 9, padding: '11px 13px' }}>
                <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9CA3AF', marginBottom: 4 }}>{active.name} angle</div>
                <div style={{ fontSize: 13, color: '#1A2B4A', fontStyle: 'italic', lineHeight: 1.4 }}>&ldquo;{t.brands[brand] || '—'}&rdquo;</div>
              </div>

              <div>
                <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9CA3AF', marginBottom: 6 }}>
                  {t.examples?.length ? 'Real posts using this layout' : 'Find examples'}
                </div>

                {t.examples?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {t.examples.map((ex, k) => (
                      <a key={k} href={ex.link} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', background: '#F8F9FB', borderRadius: 8, padding: '6px 8px' }}>
                        {ex.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ex.thumbnail} alt="" referrerPolicy="no-referrer" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 5, flexShrink: 0, background: '#E5E7EB' }} />
                        )}
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#1A2B4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ex.title || ex.source || 'View example'}
                          </span>
                          <span style={{ display: 'block', fontSize: 10, color: '#9CA3AF' }}>{ex.source} ↗</span>
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={t.links.google} target="_blank" rel="noopener noreferrer" style={linkStyle('#4285F4')}>Google Images ↗</a>
                    <a href={t.links.pinterest} target="_blank" rel="noopener noreferrer" style={linkStyle('#E60023')}>Pinterest ↗</a>
                  </div>
                )}
              </div>
            </div>
          ))}
          {shown.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: 13 }}>Nothing in this view — try another format or hit Refresh.</div>
          )}
        </div>
      )}
    </div>
  )
}

function linkStyle(color: string): React.CSSProperties {
  return { fontSize: 11.5, fontWeight: 700, color, background: color + '14', padding: '5px 11px', borderRadius: 8, textDecoration: 'none' }
}
