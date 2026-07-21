'use client'

import { useState, useEffect, useCallback } from 'react'

interface Post {
  url: string
  image: string
  caption: string
  likes: number
  comments: number
  owner: string
  type: string
}

interface Result {
  topic: string
  isTrending: boolean
  checkedAt: string
  totalFound: number
  strongCount: number
  threshold: { minPosts: number; minLikes: number }
  posts: Post[]
}

export default function MahjongPage() {
  const [data, setData] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/topic-watch?topic=mahjong')
      const json = await res.json()
      if (!res.ok || !json.success) setError(json.error || 'Check failed')
      else setData(json)
    } catch (e) { setError(String(e)) }
    setLoading(false)
  }, [])

  useEffect(() => { run() }, [run])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-pr-muted mb-1">Topic Watch</div>
          <h1 className="text-2xl font-playfair font-semibold text-pr-text">Mahjong</h1>
          <p className="text-sm text-pr-muted mt-0.5">
            Live check of whether Mahjong is actually trending on Instagram right now
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-pr-gold text-pr-navy hover:bg-pr-gold/90 transition-all disabled:opacity-60"
        >
          {loading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {loading ? 'Checking…' : 'Re-check now'}
        </button>
      </div>

      {loading && (
        <div className="bg-white rounded-lg shadow-card p-16 text-center">
          <p className="text-pr-text font-semibold mb-1">Checking Instagram for Mahjong…</p>
          <p className="text-sm text-pr-muted">Scanning #mahjong, #mahjongnight, #mahjongtiles — 1–3 minutes.</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-5 text-sm">
          <b>Check failed:</b> {error}
        </div>
      )}

      {data && !loading && !error && (
        <>
          {/* Verdict */}
          <div
            className={`rounded-lg shadow-card p-6 mb-6 border-l-[4px] ${
              data.isTrending ? 'bg-white border-brand-jameson' : 'bg-white border-pr-muted'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                  data.isTrending ? 'bg-brand-jameson/10 text-brand-jameson' : 'bg-pr-muted/10 text-pr-muted'
                }`}
              >
                {data.isTrending ? 'TRENDING' : 'NOT A TREND'}
              </span>
              <span className="text-xs text-pr-muted">
                Checked {new Date(data.checkedAt).toLocaleString('en-GB')}
              </span>
            </div>
            <p className="text-sm text-pr-text">
              {data.isTrending ? (
                <>
                  Mahjong <b>is showing real traction</b> — {data.strongCount} posts above{' '}
                  {data.threshold.minLikes.toLocaleString()} likes out of {data.totalFound} recent posts found.
                </>
              ) : (
                <>
                  <b>Mahjong is not currently a trend.</b> Only {data.strongCount} post
                  {data.strongCount === 1 ? '' : 's'} cleared {data.threshold.minLikes.toLocaleString()} likes
                  (need {data.threshold.minPosts}), from {data.totalFound} recent posts found. Recent posts are shown
                  below for reference.
                </>
              )}
            </p>
          </div>

          {/* Posts */}
          {data.posts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {data.posts.map((p, i) => (
                <div key={i} className="bg-white rounded-lg shadow-card overflow-hidden flex flex-col">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" referrerPolicy="no-referrer" className="w-full h-44 object-cover bg-pr-bg" />
                  ) : (
                    <div className="w-full h-44 bg-pr-bg flex items-center justify-center text-xs text-pr-muted">
                      No preview image
                    </div>
                  )}
                  <div className="p-4 flex flex-col gap-2 flex-1">
                    <p className="text-xs text-pr-text leading-relaxed flex-1">{p.caption || '(no caption)'}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-pr-muted">
                        @{p.owner} · ♥ {p.likes.toLocaleString()}
                      </span>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-white px-2.5 py-1 rounded-lg"
                        style={{ background: '#E1306C' }}
                      >
                        Open ↗
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-card p-12 text-center">
              <p className="text-pr-text font-semibold mb-1">No Mahjong posts found at all</p>
              <p className="text-sm text-pr-muted">Nothing recent surfaced for these hashtags.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
