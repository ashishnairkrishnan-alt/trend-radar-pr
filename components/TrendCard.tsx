'use client'

import { useState } from 'react'
import BrandScoreBars from './BrandScoreBars'
import type { ScoredTrend } from '@/types'
import { BRANDS } from '@/lib/config'

interface TrendCardProps {
  trend: ScoredTrend
}

function PlatformBadge({ platform }: { platform: string }) {
  const isIG = platform === 'instagram'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider text-white"
      style={{ backgroundColor: isIG ? '#E1306C' : '#010101' }}
    >
      {isIG ? 'IG' : 'TT'}
    </span>
  )
}

function TopBrandChip({ brand }: { brand: string }) {
  const brandObj = BRANDS.find(
    (b) => b.name.toLowerCase().includes(brand.toLowerCase()) || brand.toLowerCase().includes(b.key)
  )
  const color = brandObj?.color || '#C9A84C'
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
      {brand}
    </span>
  )
}

function getTikTokVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/)
  return match ? match[1] : null
}

function getSourceLabel(url: string): string {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    if (u.hostname.includes('tiktok')) {
      // @username/video/ID → show "@username"
      const username = parts.find(p => p.startsWith('@'))
      return username || 'TikTok video'
    }
    if (u.hostname.includes('instagram')) {
      if (parts[0] === 'reel' && parts[1]) return `Reel · ${parts[1]}`
      if (parts[0] === 'p' && parts[1]) return `Post · ${parts[1]}`
      return 'Instagram post'
    }
    return url
  } catch {
    return url
  }
}

function SourceVideo({ url, platform }: { url: string; platform: string }) {
  const [showEmbed, setShowEmbed] = useState(false)
  const isIG = platform === 'instagram'
  const isTikTok = platform === 'tiktok'
  const videoId = isTikTok ? getTikTokVideoId(url) : null
  // Only show Watch/embed for real video URLs (not hashtag/explore pages)
  const isRealVideo = !!videoId
  const bgColor = isIG ? '#E1306C' : '#010101'

  return (
    <div className="rounded-xl overflow-hidden border border-gray-100" style={{ background: '#F8F9FB' }}>
      {/* Header bar — always visible */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: bgColor }}>
            {isIG ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="white" strokeWidth="2" fill="none"/>
                <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" fill="none"/>
                <circle cx="17.5" cy="6.5" r="1.5" fill="white"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.5a8.16 8.16 0 0 0 4.77 1.52V7.57a4.85 4.85 0 0 1-1-.88z"/>
              </svg>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-pr-muted font-medium leading-none mb-0.5">
              Trend spotted in
            </p>
            <p className="text-[11px] font-semibold text-pr-text truncate max-w-[160px]">
              {getSourceLabel(url)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Embed toggle — only for real TikTok video URLs */}
          {isTikTok && isRealVideo && (
            <button
              onClick={() => setShowEmbed(!showEmbed)}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
              style={{
                background: showEmbed ? '#010101' : 'rgba(1,1,1,0.06)',
                color: showEmbed ? '#fff' : '#010101',
              }}
            >
              {showEmbed ? 'Hide' : 'Watch'}
            </button>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg text-white"
            style={{ background: bgColor }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open
          </a>
        </div>
      </div>

      {/* TikTok inline embed */}
      {showEmbed && isRealVideo && videoId && (
        <div style={{ height: 500, position: 'relative', background: '#000' }}>
          <iframe
            src={`https://www.tiktok.com/embed/v2/${videoId}`}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            allow="encrypted-media"
            allowFullScreen
            title="TikTok video"
          />
        </div>
      )}

      {/* Instagram note */}
      {isIG && showEmbed && (
        <p className="px-3 pb-3 text-[11px] text-pr-muted">
          Instagram blocks third-party embeds.{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-pr-navy font-medium underline">
            Open post
          </a>{' '}
          to watch.
        </p>
      )}
    </div>
  )
}

export default function TrendCard({ trend }: TrendCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-card hover:shadow-card-hover transition-shadow duration-200 overflow-hidden border-l-[3px] border-pr-gold flex flex-col">
      <div className="p-5 flex flex-col gap-4">

        {/* Row 1: Platform badge + spike */}
        <div className="flex items-center justify-between">
          <PlatformBadge platform={trend.platform} />
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-extrabold tracking-tight bg-pr-gold text-pr-navy tabular">
            +{trend.spike_pct}%
          </span>
        </div>

        {/* Row 2: Trend name */}
        <div>
          <h3 className="text-lg font-bold text-pr-text leading-snug" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
            {trend.trend_name}
          </h3>
          <p className="text-sm text-pr-muted italic leading-relaxed mt-1">
            {trend.emotional_hook}
          </p>
        </div>

        {/* Row 3: Source video — prominent, right after the headline */}
        {trend.source_url && (
          <SourceVideo url={trend.source_url} platform={trend.platform} />
        )}

        {/* Row 4: Brand scores */}
        <div className="bg-pr-bg rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-widest text-pr-muted mb-2 font-medium">Brand Relevance</p>
          <BrandScoreBars trend={trend} />
        </div>

        {/* Row 5: Best fit + opportunity */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-pr-muted">Best fit</span>
          <TopBrandChip brand={trend.top_brand} />
        </div>

        <p className="text-sm text-pr-text italic leading-relaxed" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
          &ldquo;{trend.opportunity_note}&rdquo;
        </p>

        {/* Row 6: Content angle */}
        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-pr-navy text-pr-gold text-[11px] font-semibold w-fit">
          {trend.content_angle}
        </span>

      </div>
    </div>
  )
}
