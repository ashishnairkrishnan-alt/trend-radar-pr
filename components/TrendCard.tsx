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

// Extracts TikTok video ID from a URL like https://www.tiktok.com/@user/video/7391234567890
function getTikTokVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/)
  return match ? match[1] : null
}

function VideoEmbed({ url, platform }: { url: string; platform: string }) {
  const [expanded, setExpanded] = useState(false)
  const isIG = platform === 'instagram'
  const isTikTok = platform === 'tiktok'
  const videoId = isTikTok ? getTikTokVideoId(url) : null

  return (
    <div className="border-t border-pr-bg mt-3 pt-3">
      {/* Always show "View" link */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-pr-muted font-medium">
          Source
        </span>
        <div className="flex items-center gap-2">
          {/* Embed button — only for TikTok with a video ID */}
          {isTikTok && videoId && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors"
              style={{
                background: expanded ? '#010101' : 'transparent',
                color: expanded ? '#fff' : '#010101',
                border: '1px solid #010101',
              }}
            >
              {expanded ? 'Hide' : 'Watch'}
            </button>
          )}
          {/* Open link */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md text-white transition-opacity hover:opacity-90"
            style={{ background: isIG ? '#E1306C' : '#010101' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            {isIG ? 'Open on Instagram' : 'Open on TikTok'}
          </a>
        </div>
      </div>

      {/* TikTok embed iframe — only expands for real video URLs */}
      {expanded && videoId && (
        <div className="mt-3 rounded-lg overflow-hidden" style={{ height: 480 }}>
          <iframe
            src={`https://www.tiktok.com/embed/v2/${videoId}`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="encrypted-media"
            allowFullScreen
            title="TikTok video"
          />
        </div>
      )}

      {/* Instagram — no embed (blocked by Meta), show a note */}
      {isIG && expanded && (
        <p className="mt-2 text-[11px] text-pr-muted">
          Instagram blocks third-party embeds.{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
            Open in new tab
          </a>{' '}
          to view.
        </p>
      )}
    </div>
  )
}

export default function TrendCard({ trend }: TrendCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-card hover:shadow-card-hover transition-shadow duration-200 overflow-hidden border-l-[3px] border-pr-gold flex flex-col">
      <div className="p-5 flex flex-col flex-1">

        {/* Platform + spike */}
        <div className="flex items-center justify-between mb-3">
          <PlatformBadge platform={trend.platform} />
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-extrabold tracking-tight bg-pr-gold text-pr-navy">
            +{trend.spike_pct}%
          </span>
        </div>

        {/* Trend name */}
        <h3 className="text-lg font-bold text-pr-text leading-snug mb-1.5" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
          {trend.trend_name}
        </h3>

        {/* Emotional hook */}
        <p className="text-sm text-pr-muted italic leading-relaxed mb-4">
          {trend.emotional_hook}
        </p>

        {/* Brand score bars */}
        <div className="bg-pr-bg rounded-lg p-3 mb-4">
          <p className="text-[10px] uppercase tracking-widest text-pr-muted mb-2 font-medium">
            Brand Relevance
          </p>
          <BrandScoreBars trend={trend} />
        </div>

        {/* Top brand */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-widest text-pr-muted">Best fit</span>
          <TopBrandChip brand={trend.top_brand} />
        </div>

        {/* Opportunity note */}
        <p className="text-sm text-pr-text italic leading-relaxed mb-4" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
          &ldquo;{trend.opportunity_note}&rdquo;
        </p>

        {/* Content angle */}
        <div className="mb-3">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-pr-navy text-pr-gold text-[11px] font-semibold">
            {trend.content_angle}
          </span>
        </div>

        {/* Video / source embed */}
        {trend.source_url && (
          <VideoEmbed url={trend.source_url} platform={trend.platform} />
        )}
      </div>
    </div>
  )
}
