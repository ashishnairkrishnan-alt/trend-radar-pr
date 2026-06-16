'use client'

import { BRANDS } from '@/lib/config'
import type { ScoredTrend } from '@/types'

interface BrandScoreBarsProps {
  trend: ScoredTrend
  compact?: boolean
}

export default function BrandScoreBars({ trend, compact = false }: BrandScoreBarsProps) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {BRANDS.map((brand) => {
        const score = trend[brand.scoreField] as number
        const pct = (score / 5) * 100
        const isTop = trend.top_brand.toLowerCase().includes(brand.key)

        return (
          <div key={brand.key}>
            <div className="flex items-center justify-between mb-0.5">
              <span
                className={`text-[10px] uppercase tracking-widest font-medium ${
                  isTop ? 'text-pr-text font-bold' : 'text-pr-muted'
                }`}
              >
                {compact ? brand.key.charAt(0).toUpperCase() + brand.key.slice(1) : brand.name}
              </span>
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: brand.color }}
              >
                {score}/5
              </span>
            </div>
            <div className="bg-pr-bg rounded-full h-1.5 w-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: brand.color,
                  opacity: isTop ? 1 : 0.55,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
