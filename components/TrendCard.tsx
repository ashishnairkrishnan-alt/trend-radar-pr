'use client'

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
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider text-white`}
      style={{ backgroundColor: isIG ? '#E1306C' : '#010101' }}
    >
      {isIG ? 'IG' : 'TT'}
    </span>
  )
}

function TopBrandChip({ brand }: { brand: string }) {
  const brandObj = BRANDS.find((b) =>
    b.name.toLowerCase().includes(brand.toLowerCase()) ||
    brand.toLowerCase().includes(b.key)
  )
  const color = brandObj?.color || '#C9A84C'

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
      style={{
        backgroundColor: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      <span
        className="w-2 h-2 rounded-full inline-block"
        style={{ backgroundColor: color }}
      />
      {brand}
    </span>
  )
}

export default function TrendCard({ trend }: TrendCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-card hover:shadow-card-hover transition-shadow duration-200 overflow-hidden border-l-[3px] border-pr-gold flex flex-col">
      {/* Card body */}
      <div className="p-5 flex flex-col flex-1">
        {/* Platform + spike */}
        <div className="flex items-center justify-between mb-3">
          <PlatformBadge platform={trend.platform} />
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-extrabold tracking-tight bg-pr-gold text-pr-navy">
            +{trend.spike_pct}%
          </span>
        </div>

        {/* Trend name */}
        <h3 className="text-lg font-bold text-pr-text font-serif leading-snug mb-1.5">
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
        <p className="text-sm text-pr-text font-serif italic leading-relaxed mb-4">
          &ldquo;{trend.opportunity_note}&rdquo;
        </p>

        {/* Content angle tag */}
        <div className="mt-auto">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-pr-navy text-pr-gold text-[11px] font-semibold">
            {trend.content_angle}
          </span>
        </div>
      </div>
    </div>
  )
}
